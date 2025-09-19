import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/products
router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/products (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { name, sku, price, stock } = req.body;
  try {
    const p = await prisma.product.create({ data: { name, sku, price: parseFloat(price), stock: parseInt(stock || 0) } });
    res.status(201).json(p);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore creazione prodotto' });
  }
});

// PUT /api/products/:id (admin only)
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, sku, price, stock } = req.body;
  try {
    const updated = await prisma.product.update({ where: { id: parseInt(id) }, data: { name, sku, price: parseFloat(price), stock: parseInt(stock) } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore aggiornamento prodotto' });
  }
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Prodotto eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore eliminazione prodotto' });
  }
});

export default router;
