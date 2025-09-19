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
    // fetch products
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsMap = Object.fromEntries(products.map(p => [p.id, p]));

    let total = 0;
    const createItems = items.map(i => {
      const p = productsMap[i.productId];
      const qty = parseInt(i.quantity || 0);
      const unitPrice = p ? p.price : 0;
      total += unitPrice * qty;
      return { productId: i.productId, quantity: qty, unitPrice };
    });

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total,
        status: 'pending',
        items: { create: createItems }
      },
      include: { items: true }
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore creazione ordine' });
  }
});

export default router;
