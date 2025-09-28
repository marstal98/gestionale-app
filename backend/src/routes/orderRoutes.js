import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import { logApp, logAudit } from '../utils/logger.js'

const router = express.Router()
const prisma = new PrismaClient()
console.log('[orderRoutes] module loaded')

// Helper: send notifications when an order becomes active (pending or in_progress)
async function sendOrderNotificationsIfActive(orderId, reason = 'status_change', force = false) {
  // Email notifications for orders have been disabled per configuration.
  // We keep this helper in place so callers remain valid but it only logs the event.
  try {
    const orderFull = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true, assignedTo: true, createdBy: true } });
    if (!orderFull) return;
    logApp('order.email_disabled', { orderId: orderFull.id, reason, status: orderFull.status, force: !!force });
    return;
  } catch (e) {
    console.error('Error in sendOrderNotificationsIfActive (emails disabled)', e);
  }
}

// Reuse include for queries
const ORDER_INCLUDE = {
  include: {
    items: {
      include: {
        product: true,
      },
    },
    customer: true,
    createdBy: true,
    assignedTo: true,
  },
}

// GET /api/orders - list with optional filters
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user;
    const showDeleted = String(req.query.deleted || 'false') === 'true';
    // respect roles: admin sees all, employee sees assigned, customer sees own
    if (user.role === 'admin') {
      const where = showDeleted ? {} : { deletedAt: null };
      const orders = await prisma.order.findMany({ where, ...ORDER_INCLUDE });
      return res.json(orders);
    }
    if (user.role === 'employee') {
      const where = showDeleted ? { assignedToId: user.id } : { assignedToId: user.id, deletedAt: null };
      const orders = await prisma.order.findMany({ where, ...ORDER_INCLUDE });
      return res.json(orders);
    }
    const where = showDeleted ? { customerId: user.id } : { customerId: user.id, deletedAt: null };
    const orders = await prisma.order.findMany({ where, ...ORDER_INCLUDE });
    res.json(orders);
  } catch (err) {
    next(err)
  }
})

// GET /api/orders/:id - single order
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const user = req.user;
    console.log(`[orderRoutes] GET /orders/${id} requested by user ${user?.id || 'unknown'}`);
    if (Number.isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' })

    const order = await prisma.order.findUnique({ where: { id }, ...ORDER_INCLUDE })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// POST /:id/cancel
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  try {
    const order = await prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    if (user.role !== 'admin' && user.id !== order.createdById && user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Ordine già cancellato' });
    if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile cancellarlo." });

    await prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
        await tx.inventoryMovement.create({ data: { productId: it.productId, type: 'release', quantity: it.quantity, metadata: { orderId: order.id } } });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    });

    try { logAudit('cancel', 'order', order.id, req.user || {}, { cancelledBy: req.user?.id || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.cancel', { orderId: order.id, by: req.user?.id || null });
    res.json({ cancelled: true });
  } catch (err) { console.error('Cancel order error', err); res.status(500).json({ error: 'Errore cancellazione ordine' }); }
});

// PUT /:id/assign
router.put('/:id/assign', authenticateToken, async (req, res) => {
  console.log('[orderRoutes] assign handler called for', req.params.id)
  const { id } = req.params; const { assignedToId } = req.body; const user = req.user;
  try {
    const orderId = parseInt(id); if (Number.isNaN(orderId)) return res.status(400).json({ error: 'Order id non valido' });
    const order = await prisma.order.findUnique({ where: { id: orderId } }); if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile modificarlo." });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Solo admin può riassegnare ordini' });
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: parseInt(assignedToId) } }); if (!assignee) return res.status(400).json({ error: 'Utente assegnato non trovato' });
      if (!['employee','admin'].includes(String(assignee.role))) return res.status(400).json({ error: 'Assegnatario deve essere un dipendente (employee) o admin' });
    }
  const parsedAssignedTo = assignedToId ? parseInt(assignedToId) : null;
  const newData = { assignedToId: parsedAssignedTo };
  // If assigned, ensure status becomes in_progress, otherwise fallback to pending unless final
  if (parsedAssignedTo) newData.status = 'in_progress'; else if (order.status !== 'completed' && order.status !== 'cancelled') newData.status = 'pending';
    const prevAssigneeId = order.assignedToId;
    const updated = await prisma.order.update({ where: { id: order.id }, data: newData });
    try { logAudit('assign', 'order', updated.id, req.user || {}, { assignedToId: updated.assignedToId || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.assign', { orderId: updated.id, by: req.user?.id || null, assignedToId: updated.assignedToId || null });
    // Send notifications: new assignee, previous assignee (if removed), and the admin who assigned
    (async () => {
      try {
        const tpl = await import('../utils/emailTemplates.js');
        // fetch updated with includes to get emails
        const orderFull = await prisma.order.findUnique({ where: { id: updated.id }, include: { assignedTo: true, customer: true, createdBy: true } });
        const summary = `Ordine #${orderFull.id} - Totale: ${orderFull.total}`;

        // Emails disabled: would notify new assignee here
        if (orderFull.assignedTo && orderFull.assignedTo.email) {
          logApp('order.email_skipped.assignee', { orderId: orderFull.id, assigneeEmail: orderFull.assignedTo.email, reason: 'assign_handler' });
        }

        // If the previous assignee existed and now changed, notify previous assignee only on reassignment (not on removal)
        if (prevAssigneeId && updated.assignedToId && prevAssigneeId !== updated.assignedToId) {
          try {
            const prev = await prisma.user.findUnique({ where: { id: prevAssigneeId } });
            if (prev && prev.email) {
              logApp('order.email_skipped.prev_assignee', { orderId: orderFull.id, prevAssigneeEmail: prev.email, reason: 'reassign_handler' });
            }
          } catch (e) { console.error('Lookup prev assignee failed', e); }
        }

        // Notify admin who performed the assignment (if they have email and different from assignee)
        try {
          const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (admin && admin.email && admin.email !== (orderFull.assignedTo?.email || '')) {
              logApp('order.email_skipped.admin_on_assign', { orderId: orderFull.id, adminEmail: admin.email, reason: 'assign_handler' });
            }
        } catch (e) { console.error('Admin lookup for assign failed', e); }

  // Ensure canonical notifications for order when it becomes active due to assign (emails disabled)
  try { await sendOrderNotificationsIfActive(orderFull.id, 'assign', !!req.body.sendEmail); } catch (e) { console.error('Notify after assign failed (emails disabled)', e); }

      } catch (e) {
        console.error('Error sending assignment notifications', e);
      }
    })();

    res.json({ ok: true, assignedToId: updated.assignedToId || null });
  } catch (err) { console.error('Assign order error', err); if (err && err.status && err.message) return res.status(err.status).json({ error: err.message }); res.status(500).json({ error: 'Errore assegnazione ordine' }); }
});

// PUT /:id/status
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params; const { status } = req.body; const user = req.user;
  const allowedStatuses = ['draft','pending','in_progress','completed','cancelled'];
  if (!status || !allowedStatuses.includes(status)) return res.status(400).json({ error: 'Stato non valido' });
  try {
    const order = await prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: true } }); if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile modificare lo stato." });
    // compute targetStatus: if client requests 'pending' but order is draft and there is an assignee (existing or in-payload), consider it in_progress
    let targetStatus = status;
    const payloadAssigned = typeof req.body.assignedToId !== 'undefined' && req.body.assignedToId ? parseInt(req.body.assignedToId) : null;
    const hasAssignee = !!(order.assignedToId || payloadAssigned);
    if (status === 'pending' && order.status === 'draft' && hasAssignee) {
      targetStatus = 'in_progress';
    }

    if (user.role === 'customer') {
      if (user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
      // allow customer to move draft -> pending; also allow draft -> in_progress when an assignee exists
      if (targetStatus === 'pending' && order.status !== 'draft') return res.status(400).json({ error: 'Transizione non permessa' });
      if (targetStatus === 'in_progress') {
        // permit only when moving from draft and there is an assignee
        if (!(order.status === 'draft' && order.assignedToId)) return res.status(400).json({ error: 'Transizione non permessa' });
      }
      if (targetStatus === 'cancelled' && (order.status === 'cancelled' || order.status === 'completed')) return res.status(400).json({ error: 'Ordine già in stato finale' });
    }

    if (user.role === 'employee') {
      if (targetStatus === 'in_progress') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per prenderlo in carico' }); if (order.status !== 'pending') return res.status(400).json({ error: 'Transizione non permessa' }); }
      else if (targetStatus === 'completed') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per completarlo' }); if (order.status !== 'in_progress') return res.status(400).json({ error: 'Transizione non permessa' }); }
      else return res.status(403).json({ error: 'Permessi insufficienti' });
    }
  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: targetStatus } });
    try { logAudit('status_change', 'order', updated.id, req.user || {}, { from: order.status, to: status }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.status_change', { orderId: updated.id, by: req.user?.id || null, from: order.status, to: status });
    // Send notifications about status change (centralized helper). Allow force via sendEmail flag in payload
    try { await sendOrderNotificationsIfActive(updated.id, 'status_change', !!req.body.sendEmail); } catch (e) { console.error('Notify after status change failed', e); }

    res.json({ ok: true, status: updated.status });
  } catch (err) { console.error('Change status error', err); res.status(500).json({ error: 'Errore cambio stato ordine' }); }
});

// POST /api/orders - create
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { items, assignedToId, customerId, status: requestedStatus } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items mancanti' });
  try {
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsMap = Object.fromEntries(products.map(p => [p.id, p]));

    for (const it of items) {
      const p = productsMap[it.productId];
      const numQty = Number(it.quantity);
      if (!p) return res.status(400).json({ error: `Prodotto ${it.productId} non trovato` });
      if (!Number.isFinite(numQty) || !Number.isInteger(numQty) || numQty <= 0) return res.status(400).json({ error: `Quantità non valida per prodotto ${it.productId}` });
      if (requestedStatus !== 'draft' && p.stock < numQty) return res.status(409).json({ error: `Stock insufficiente per prodotto ${p.id}` });
      it.quantity = numQty;
    }

    const result = await prisma.$transaction(async (tx) => {
      const txProducts = await tx.product.findMany({ where: { id: { in: productIds } } });
      const txProductsMap = Object.fromEntries(txProducts.map(p => [p.id, p]));
      let total = 0;
      for (const it of items) total += Number(txProductsMap[it.productId].price) * parseInt(it.quantity || 0);

      if (requestedStatus !== 'draft') {
        for (const it of items) {
          const qty = parseInt(it.quantity || 0);
          const updated = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
          if (updated.count === 0) throw { status: 409, message: `Stock insufficiente per prodotto ${it.productId}` };
        }
      }

      const createItems = items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity || 0), unitPrice: txProductsMap[i.productId].price }));
      const orderData = {
        createdById: user.id,
        customerId: user.role === 'admin' && customerId ? parseInt(customerId) : user.id,
        total,
        status: (requestedStatus === 'draft') ? 'draft' : (assignedToId ? 'in_progress' : 'pending'),
        items: { create: createItems }
      };

      if (assignedToId) {
        if (user.role !== 'admin') throw { status: 403, message: 'Solo admin può assegnare ordini' };
        const assignee = await tx.user.findUnique({ where: { id: parseInt(assignedToId) } });
        if (!assignee) throw { status: 400, message: 'Utente assegnato non trovato' };
        orderData.assignedToId = parseInt(assignedToId);
        if (requestedStatus !== 'draft') orderData.status = 'in_progress';
      }

      const order = await tx.order.create({ data: orderData, include: { items: true } });
      if (requestedStatus !== 'draft') {
        for (const it of order.items) {
          try { await tx.inventoryMovement.create({ data: { productId: it.productId, type: 'reserve', quantity: it.quantity, metadata: { orderId: order.id } } }); } catch (e) { console.warn('Inventory movement failed', e); }
        }
      }
      return order;
    });

  try { logAudit('create', 'order', result.id, req.user || {}, { total: result.total, items: result.items.length }); } catch (e) { console.error('Audit log error', e); }
  logApp('order.create', { orderId: result.id, by: req.user?.id || null, items: result.items.length });
    // send emails if not draft
    if (result.status !== 'draft') {
      // fetch full order with relations to ensure emails are available
      const orderFull = await prisma.order.findUnique({ where: { id: result.id }, include: { items: true, customer: true, assignedTo: true, createdBy: true } });
      const summary = `Ordine #${orderFull.id} creato. Totale: ${orderFull.total}. Items: ${orderFull.items.length}`;
      // Emails disabled: would notify customer/assignee/admins here
      logApp('order.email_skipped.create', { orderId: orderFull.id, status: orderFull.status, hasCustomerEmail: !!orderFull.customer?.email, hasAssigneeEmail: !!orderFull.assignedTo?.email });
    }
    // canonical notifications for created active orders (emails disabled)
    if (result.status !== 'draft') {
      try { await sendOrderNotificationsIfActive(result.id, 'create'); } catch (e) { console.error('Notify after create failed (emails disabled)', e); }
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Order creation error:', err && err.stack ? err.stack : err);
    if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
    if (process.env.NODE_ENV !== 'production') return res.status(500).json({ error: 'Errore creazione ordine', details: err && err.message ? String(err.message) : String(err) });
    res.status(500).json({ error: 'Errore creazione ordine' });
  }
})

// PUT /api/orders/:id - update existing order (used to edit drafts or modify before completion)
router.put('/:id', authenticateToken, async (req, res, next) => {
  const user = req.user;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { items, assignedToId, customerId, status: requestedStatus } = req.body || {};
  try {
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    // Only allow editing if order is not completed and user has rights
    if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile modificarlo." });
    if (user.role === 'customer' && order.customerId !== user.id) return res.status(403).json({ error: 'Accesso negato' });
    if (user.role === 'employee') return res.status(403).json({ error: 'Solo admin o cliente possono modificare ordini' });

    // If items provided, validate them
    let newItems = null;
    if (Array.isArray(items)) {
      const productIds = items.map(i => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
      const productsMap = Object.fromEntries(products.map(p => [p.id, p]));
      for (const it of items) {
        const p = productsMap[it.productId];
        const numQty = Number(it.quantity);
        if (!p) return res.status(400).json({ error: `Prodotto ${it.productId} non trovato` });
        if (!Number.isFinite(numQty) || !Number.isInteger(numQty) || numQty <= 0) return res.status(400).json({ error: `Quantità non valida per prodotto ${it.productId}` });
        it.quantity = numQty;
      }
      newItems = items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity || 0), unitPrice: productsMap[i.productId].price }));
    }

    // We will allow updating customer/assignee only for admin
    const updateData = {};
    if (user.role === 'admin') {
      if (typeof customerId !== 'undefined') updateData.customerId = customerId ? parseInt(customerId) : null;
      if (typeof assignedToId !== 'undefined') updateData.assignedToId = assignedToId ? parseInt(assignedToId) : null;
    }

    // Handle status transitions: if requestedStatus moves from draft -> pending/in_progress we must reserve stock
    const fromStatus = order.status;
    let toStatus = requestedStatus || order.status;
    // If publishing a draft and an assignedToId is present (either via payload or existing), prefer in_progress
    const parsedAssigned = (typeof assignedToId !== 'undefined' && assignedToId) ? parseInt(assignedToId) : null;
    const willBeAssigned = !!(parsedAssigned || order.assignedToId);
    if (fromStatus === 'draft' && toStatus !== 'draft' && willBeAssigned) {
      toStatus = 'in_progress';
    }

    // Transaction: remove existing items and recreate if items changed, optionally reserve stock
    const result = await prisma.$transaction(async (tx) => {
      // If changing from draft to active (not draft) we need to ensure stock
      if (fromStatus === 'draft' && toStatus !== 'draft' && Array.isArray(items) && items.length > 0) {
        // check and decrement stock
        for (const it of items) {
          const updated = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } });
          if (updated.count === 0) throw { status: 409, message: `Stock insufficiente per prodotto ${it.productId}` };
        }
      }

        // If items changed, delete old items and create new ones. Compute and persist new total.
        if (Array.isArray(items)) {
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          const createdItems = await Promise.all(newItems.map(i => tx.orderItem.create({ data: { orderId: order.id, productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice } })));
          updateData.items = { connect: createdItems.map(ci => ({ id: ci.id })) };
          // compute total using unitPrice from new items; fallback to product.price if missing
          let newTotal = 0;
          const prodIds = createdItems.map(ci => ci.productId);
          const prods = await tx.product.findMany({ where: { id: { in: prodIds } } });
          const prodMap = Object.fromEntries(prods.map(p => [p.id, p]));
          for (const ci of createdItems) {
            const price = (typeof ci.unitPrice === 'number' && !Number.isNaN(ci.unitPrice)) ? ci.unitPrice : (prodMap[ci.productId]?.price || 0);
            newTotal += Number(price) * Number(ci.quantity || 0);
          }
          updateData.total = newTotal;
        }

  // Update status if requested (use computed toStatus)
  if (requestedStatus) updateData.status = toStatus;
      // If admin assigned and status not draft, ensure in_progress
      if (updateData.assignedToId && updateData.status !== 'draft') updateData.status = 'in_progress';

      const updated = await tx.order.update({ where: { id: order.id }, data: updateData, include: { items: true } });

      // if we reserved stock for new items, create inventory movements
      if (fromStatus === 'draft' && toStatus !== 'draft' && Array.isArray(items) && items.length > 0) {
        for (const it of updated.items) {
          try { await tx.inventoryMovement.create({ data: { productId: it.productId, type: 'reserve', quantity: it.quantity, metadata: { orderId: updated.id } } }); } catch (e) { console.warn('Inventory movement failed', e); }
        }
      }

      return updated;
    });

    try { logAudit('update', 'order', result.id, req.user || {}, { from: fromStatus, to: requestedStatus || fromStatus }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.update', { orderId: result.id, by: req.user?.id || null });
    // If we moved from draft to active, call helper (emails disabled)
    if (fromStatus === 'draft' && (result.status !== 'draft')) {
      try { await sendOrderNotificationsIfActive(result.id, 'draft_publish'); } catch (e) { console.error('Notify after draft publish failed (emails disabled)', e); }
    }

    res.json(result);
  } catch (err) {
    console.error('Order update error', err);
    if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Errore aggiornamento ordine' });
  }
})

// DELETE /api/orders/:id - safe delete
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const user = req.user // set by authenticateToken
  const id = Number(req.params.id)
  const permanent = String(req.query.permanent || 'false') === 'true'

  try {
    if (Number.isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' })

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })

    // Customers can only delete their own draft orders -> perform soft-delete
    if (user.role !== 'admin') {
      if (order.customerId !== user.id || order.status !== 'draft') {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }

      const updated = await prisma.order.update({ where: { id }, data: { deletedAt: new Date(), deletedById: user.id } });
      try { logAudit('delete', 'order', id, req.user || {}, { deletedBy: user.id, permanent: false }); } catch (e) { console.error('Audit log error', e); }
      return res.json({ ok: true, softDeleted: true, id: updated.id })
    }

    // Admin deletion: if permanent=true then hard-delete and restore stock; otherwise soft-delete
    if (!permanent) {
      const updated = await prisma.order.update({ where: { id }, data: { deletedAt: new Date(), deletedById: user.id } });
      try { logAudit('delete', 'order', id, req.user || {}, { deletedBy: user.id, permanent: false }); } catch (e) { console.error('Audit log error', e); }
      return res.json({ ok: true, softDeleted: true, id: updated.id })
    }

    // permanent delete (admin only): restore stock and delete records
    await prisma.$transaction(async (tx) => {
      for (const oi of order.items) {
        await tx.product.update({ where: { id: oi.productId }, data: { stock: { increment: oi.quantity } } });
        await tx.inventoryMovement.create({ data: { productId: oi.productId, quantity: oi.quantity, type: 'RESTORE_ON_ORDER_DELETE', metadata: JSON.stringify({ orderId: id, by: user.id }) } });
      }
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });

    try { logAudit('delete', 'order', id, req.user || {}, { deletedBy: user.id, permanent: true }); } catch (e) { console.error('Audit log error', e); }
    res.json({ ok: true, permanent: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/orders/:id/restore - restore soft-deleted order
router.post('/:id/restore', authenticateToken, async (req, res, next) => {
  const user = req.user; const id = Number(req.params.id);
  try {
    if (Number.isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' })
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    // only admin can restore (could be changed to allow customer restore of own if desired)
    if (user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Forbidden' });
    const updated = await prisma.order.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
    try { logAudit('restore', 'order', id, req.user || {}, { restoredBy: user.id }); } catch (e) { console.error('Audit log error', e); }
    res.json({ ok: true, restored: true, id: updated.id });
  } catch (err) { next(err); }
})

export default router

