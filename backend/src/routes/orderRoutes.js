import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/orders - admin sees all, user sees own
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user; // { id, role }
    if (user.role === 'admin') {
      const orders = await prisma.order.findMany({ include: { items: true } });
      return res.json(orders);
    }
    const orders = await prisma.order.findMany({ where: { userId: user.id }, include: { items: true } });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/orders - create order for authenticated user
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { items } = req.body; // [{ productId, quantity }]

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

      const order = await prismaTx.order.create({
        data: {
          userId: user.id,
          total,
          status: 'pending',
          items: { create: createItems }
        },
        include: { items: true }
      });

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

    res.status(201).json(result);
  } catch (err) {
    console.error('Order creation error:', err);
    if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Errore creazione ordine' });
  }
});

export default router;
