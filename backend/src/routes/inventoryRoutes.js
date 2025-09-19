import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/inventory/adjust - manual adjustment of stock
router.post('/adjust', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { productId, quantity, reason } = req.body; // quantity can be positive or negative
  if (!productId || typeof quantity !== 'number') return res.status(400).json({ error: 'productId e quantity obbligatori' });
  try {
    // Update stock
    const updated = await prisma.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
    // Record movement
    await prisma.inventoryMovement.create({ data: { productId, type: 'adjust', quantity, metadata: { reason } } });
    res.json({ product: updated });
  } catch (err) {
    console.error('Inventory adjust error', err);
    res.status(500).json({ error: 'Errore adjust inventario' });
  }
});

// POST /api/inventory/reserve - reserve stock for an order (decrement if available)
router.post('/reserve', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { productId, quantity, orderId } = req.body;
  if (!productId || typeof quantity !== 'number') return res.status(400).json({ error: 'productId e quantity obbligatori' });
  try {
    // Atomically decrement only if enough stock
    const result = await prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.product.updateMany({ where: { id: productId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
      if (updated.count === 0) throw new Error('Stock insufficiente');
      await prismaTx.inventoryMovement.create({ data: { productId, type: 'reserve', quantity, metadata: { orderId } } });
      return true;
    });
    res.json({ reserved: true });
  } catch (err) {
    console.error('Reserve error', err);
    if (err.message && err.message.includes('insufficiente')) return res.status(409).json({ error: 'Stock insufficiente' });
    res.status(500).json({ error: 'Errore reserve inventario' });
  }
});

// POST /api/inventory/release - release reserved stock back to product
router.post('/release', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { productId, quantity, orderId } = req.body;
  if (!productId || typeof quantity !== 'number') return res.status(400).json({ error: 'productId e quantity obbligatori' });
  try {
    const updated = await prisma.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
    await prisma.inventoryMovement.create({ data: { productId, type: 'release', quantity, metadata: { orderId } } });
    res.json({ released: true, product: updated });
  } catch (err) {
    console.error('Release error', err);
    res.status(500).json({ error: 'Errore release inventario' });
  }
});

// GET /api/inventory/logs - list inventory movements, optional productId
router.get('/logs', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const productId = req.query.productId ? parseInt(req.query.productId) : undefined;
  try {
    const where = productId ? { where: { productId }, orderBy: { createdAt: 'desc' } } : { orderBy: { createdAt: 'desc' } };
    const logs = await prisma.inventoryMovement.findMany(where);
    res.json(logs);
  } catch (err) {
    console.error('Inventory logs error', err);
    res.status(500).json({ error: 'Errore recupero logs inventario' });
  }
});

export default router;
