import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import { logApp, logAudit } from '../utils/logger.js'

const router = express.Router()
const prisma = new PrismaClient()
console.log('[orderRoutes] module loaded')

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
    // respect roles: admin sees all, employee sees assigned, customer sees own
    if (user.role === 'admin') {
      const orders = await prisma.order.findMany(ORDER_INCLUDE);
      return res.json(orders);
    }
    if (user.role === 'employee') {
      const orders = await prisma.order.findMany({ where: { assignedToId: user.id }, ...ORDER_INCLUDE });
      return res.json(orders);
    }
    const orders = await prisma.order.findMany({ where: { customerId: user.id }, ...ORDER_INCLUDE });
    res.json(orders);
  } catch (err) {
    next(err)
  }
})

// GET /api/orders/:id - single order
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
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
    const newData = { assignedToId: assignedToId ? parseInt(assignedToId) : null };
    if (assignedToId) newData.status = 'in_progress'; else if (order.status !== 'completed' && order.status !== 'cancelled') newData.status = 'pending';
    const updated = await prisma.order.update({ where: { id: order.id }, data: newData });
    try { logAudit('assign', 'order', updated.id, req.user || {}, { assignedToId: updated.assignedToId || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.assign', { orderId: updated.id, by: req.user?.id || null, assignedToId: updated.assignedToId || null });
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
    if (user.role === 'customer') {
      if (user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
      if (status === 'pending' && order.status !== 'draft') return res.status(400).json({ error: 'Transizione non permessa' });
      if (status === 'cancelled' && (order.status === 'cancelled' || order.status === 'completed')) return res.status(400).json({ error: 'Ordine già in stato finale' });
    }
    if (user.role === 'employee') {
      if (status === 'in_progress') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per prenderlo in carico' }); if (order.status !== 'pending') return res.status(400).json({ error: 'Transizione non permessa' }); }
      else if (status === 'completed') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per completarlo' }); if (order.status !== 'in_progress') return res.status(400).json({ error: 'Transizione non permessa' }); }
      else return res.status(403).json({ error: 'Permessi insufficienti' });
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status } });
    try { logAudit('status_change', 'order', updated.id, req.user || {}, { from: order.status, to: status }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.status_change', { orderId: updated.id, by: req.user?.id || null, from: order.status, to: status });
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
    res.status(201).json(result);
  } catch (err) {
    console.error('Order creation error:', err && err.stack ? err.stack : err);
    if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
    if (process.env.NODE_ENV !== 'production') return res.status(500).json({ error: 'Errore creazione ordine', details: err && err.message ? String(err.message) : String(err) });
    res.status(500).json({ error: 'Errore creazione ordine' });
  }
})

// DELETE /api/orders/:id - safe delete
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const user = req.user // set by authenticateToken
  const id = Number(req.params.id)

  try {
    if (Number.isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' })

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })

    // Customers can only delete their own draft orders
    if (user.role !== 'admin') {
      if (order.customerId !== user.id || order.status !== 'draft') {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }

      // Delete orderItems then order
      await prisma.orderItem.deleteMany({ where: { orderId: id } })
      await prisma.order.delete({ where: { id } })
      return res.json({ ok: true })
    }

    // Admin deletion: restore stock and create inventoryMovement entries inside a transaction
    await prisma.$transaction(async (tx) => {
      // For each orderItem, restore product.stock and create inventoryMovement
      for (const oi of order.items) {
        await tx.product.update({
          where: { id: oi.productId },
          data: { stock: { increment: oi.quantity } },
        })

        await tx.inventoryMovement.create({
          data: {
            productId: oi.productId,
            quantity: oi.quantity,
            type: 'RESTORE_ON_ORDER_DELETE',
            metadata: JSON.stringify({ orderId: id, by: user.id }),
          },
        })
      }

      // Delete items and order
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })

    logAudit(user.id, `Admin ${user.id} deleted order ${id}`)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router

