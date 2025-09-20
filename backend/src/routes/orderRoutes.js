import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { logApp, logAudit } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/orders - admin sees all, user sees own
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user; // { id, role }
    if (user.role === 'admin') {
      // admin: return all orders and include customer/assignee/creator
      const orders = await prisma.order.findMany({ include: { items: true, assignedTo: true, customer: true, createdBy: true } });
      return res.json(orders);
    }
    // employee: show orders assigned to them
    if (user.role === 'employee') {
      const orders = await prisma.order.findMany({ where: { assignedToId: user.id }, include: { items: true, assignedTo: true, customer: true, createdBy: true } });
      return res.json(orders);
    }
    // customer: show orders where they are the customer
    const orders = await prisma.order.findMany({ where: { customerId: user.id }, include: { items: true, assignedTo: true, customer: true, createdBy: true } });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/orders - create order for authenticated user
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { items, assignedToId, customerId } = req.body; // [{ productId, quantity }]

  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items mancanti' });

  try {
    // Transactional creation: first, pre-check stock to fail fast
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsMap = Object.fromEntries(products.map(p => [p.id, p]));

    // Pre-validate quantities and stock
    for (const it of items) {
      const p = productsMap[it.productId];
      const qty = parseInt(it.quantity || 0);
      console.log('[order] pre-validate product', it.productId, 'stock=', p ? p.stock : null, 'requested=', qty);
      if (!p) return res.status(400).json({ error: `Prodotto ${it.productId} non trovato` });
      if (qty <= 0) return res.status(400).json({ error: `Quantità non valida per prodotto ${it.productId}` });
      if (p.stock < qty) return res.status(409).json({ error: `Stock insufficiente per prodotto ${p.id}` });
    }

  // All good — perform decrement and order creation in a transaction
    const result = await prisma.$transaction(async (prismaTx) => {
      // Re-fetch products inside transaction for accurate unitPrice
      const txProducts = await prismaTx.product.findMany({ where: { id: { in: productIds } } });
      const txProductsMap = Object.fromEntries(txProducts.map(p => [p.id, p]));

      let total = 0;
      for (const it of items) {
        const p = txProductsMap[it.productId];
        const qty = parseInt(it.quantity || 0);
        total += Number(p.price) * qty;
      }

      // For each product attempt an updateMany with stock >= qty to avoid negative stock
      for (const it of items) {
        const qty = parseInt(it.quantity || 0);
        const updated = await prismaTx.product.updateMany({ where: { id: it.productId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
        console.log('[order][tx] updateMany for product', it.productId, 'qty=', qty, 'updated.count=', updated.count);
        if (updated.count === 0) {
          // Some other concurrent operation ate the stock — abort
          throw { status: 409, message: `Stock insufficiente per prodotto ${it.productId}` };
        }
      }

      const createItems = items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity || 0), unitPrice: txProductsMap[i.productId].price }));

      const orderData = {
        // set creator of the order
        createdById: user.id,
        // default customer: if admin provided a customerId use it, otherwise the creator is the customer
        customerId: user.role === 'admin' && customerId ? parseInt(customerId) : user.id,
        total,
        status: 'pending',
        items: { create: createItems }
      };

      // optional assignee: only admin can assign during creation
      if (assignedToId) {
        if (user.role !== 'admin') {
          throw { status: 403, message: 'Solo admin può assegnare ordini' };
        }
        // verify assignee exists and has allowed role
        const assignee = await prismaTx.user.findUnique({ where: { id: parseInt(assignedToId) } });
        if (!assignee) throw { status: 400, message: 'Utente assegnato non trovato' };
        if (!['employee','admin'].includes(String(assignee.role))) throw { status: 400, message: 'Assegnatario deve essere un dipendente (employee) o admin' };
        orderData.assignedToId = parseInt(assignedToId);
      }

      const order = await prismaTx.order.create({ data: orderData, include: { items: true } });

      // Record inventory reservations for each order item
      for (const it of order.items) {
        try {
          await prismaTx.inventoryMovement.create({ data: { productId: it.productId, type: 'reserve', quantity: it.quantity, metadata: { orderId: order.id } } });
          try { logAudit('reserve', 'inventory', null, req.user || {}, { orderId: order.id, productId: it.productId, qty: it.quantity }); } catch (e) { console.error('Audit log error', e); }
          logApp('inventory.reserve', { orderId: order.id, productId: it.productId, qty: it.quantity, by: req.user?.id || null });
        } catch (mvErr) {
          console.warn('Failed to record inventory movement for reservation', mvErr);
          // non-fatal: continue
        }
      }

      return order;
    });
    // Diagnostic: read product stock after transaction
    try {
      for (const it of items) {
        const pAfter = await prisma.product.findUnique({ where: { id: it.productId } });
        console.log('[order] post-tx product', it.productId, 'stock after tx =', pAfter ? pAfter.stock : null);
      }
    } catch (e) {
      console.warn('Could not read post-tx product stock', e);
    }

  try { logAudit('create', 'order', result.id, req.user || {}, { total: result.total, items: result.items.length, assignedToId: result.assignedToId || null, customerId: result.customerId || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.create', { orderId: result.id, by: req.user?.id || null, items: result.items.length });
    res.status(201).json(result);
  } catch (err) {
    console.error('Order creation error:', err);
    if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Errore creazione ordine' });
  }
});

export default router;

// POST /api/orders/:id/cancel - cancel an order and release reserved stock
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  try {
  const order = await prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
  // Only admin or order owner (creator or customer) can cancel
  if (user.role !== 'admin' && user.id !== order.createdById && user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Ordine già cancellato' });

    // Release stock in a transaction and log movements
    await prisma.$transaction(async (prismaTx) => {
      for (const it of order.items) {
        await prismaTx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
        await prismaTx.inventoryMovement.create({ data: { productId: it.productId, type: 'release', quantity: it.quantity, metadata: { orderId: order.id } } });
      }
      await prismaTx.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    });

    try { logAudit('cancel', 'order', order.id, req.user || {}, { cancelledBy: req.user?.id || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.cancel', { orderId: order.id, by: req.user?.id || null });
    res.json({ cancelled: true });
  } catch (err) {
    console.error('Cancel order error', err);
    res.status(500).json({ error: 'Errore cancellazione ordine' });
  }
});

// PUT /api/orders/:id/assign - change the assignee of an order
router.put('/:id/assign', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { assignedToId } = req.body;
  const user = req.user;

  try {
  const order = await prisma.order.findUnique({ where: { id: parseInt(id) } });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });

  // Only admin can reassign
  if (user.role !== 'admin') return res.status(403).json({ error: 'Solo admin può riassegnare ordini' });

    // verify assignee exists if provided
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: parseInt(assignedToId) } });
      if (!assignee) return res.status(400).json({ error: 'Utente assegnato non trovato' });
      if (!['employee','admin'].includes(String(assignee.role))) return res.status(400).json({ error: 'Assegnatario deve essere un dipendente (employee) o admin' });
    }

    const updated = await prisma.order.update({ where: { id: order.id }, data: { assignedToId: assignedToId ? parseInt(assignedToId) : null } });

    try { logAudit('assign', 'order', updated.id, req.user || {}, { assignedToId: updated.assignedToId || null }); } catch (e) { console.error('Audit log error', e); }
    logApp('order.assign', { orderId: updated.id, by: req.user?.id || null, assignedToId: updated.assignedToId || null });

    res.json({ ok: true, assignedToId: updated.assignedToId || null });
  } catch (err) {
    console.error('Assign order error', err);
    res.status(500).json({ error: 'Errore assegnazione ordine' });
  }
});
