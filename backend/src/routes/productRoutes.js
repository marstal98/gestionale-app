import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const upload = multer({ storage: multer.memoryStorage() });

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

// POST /api/products/import (admin only) - upload CSV to create ONLY new products (skip existing by sku)
// CSV expected headers: name,sku,price,stock
router.post('/import', authenticateToken, authorizeRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
    const text = req.file.buffer.toString('utf8');
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    // Map rows to product data, filter out rows without sku or name
    const productsToCreate = records.map((r, idx) => ({
      __row: idx + 1,
      name: r.name || '',
      sku: r.sku || null,
      price: isNaN(parseFloat(r.price)) ? null : parseFloat(r.price),
      stock: isNaN(parseInt(r.stock)) ? null : parseInt(r.stock),
    }));

    // Validate rows and build payload
    const validRows = [];
    const errors = [];
    productsToCreate.forEach((p) => {
      if (!p.name || !p.sku) {
        errors.push({ row: p.__row, error: 'Missing name or sku' });
        return;
      }
      if (p.price === null) {
        errors.push({ row: p.__row, error: 'Invalid price' });
        return;
      }
      if (p.stock === null) {
        errors.push({ row: p.__row, error: 'Invalid stock' });
        return;
      }
      validRows.push({ name: p.name, sku: p.sku, price: p.price, stock: p.stock });
    });

    if (validRows.length === 0) return res.status(400).json({ error: 'Nessun prodotto valido nel file', errors });

    // First attempt: createMany with skipDuplicates for performance
    try {
      const result = await prisma.product.createMany({ data: validRows, skipDuplicates: true });
      // result.count is number created
      res.json({ created: result.count, skipped: validRows.length - result.count, errors });
      return;
    } catch (bulkErr) {
      console.error('createMany failed, falling back to per-row create', bulkErr);
      // Fall back to per-row create to capture row-level failures
    }

    // Fallback: try to create one by one and report per-row
    let created = 0;
    let skipped = 0;
    for (const p of validRows) {
      try {
        await prisma.product.create({ data: p });
        created++;
      } catch (rowErr) {
        // If unique constraint violation (duplicate sku), skip
        const msg = rowErr.message || String(rowErr);
        if (/Unique constraint failed on the fields|Unique constraint|Unique violation/i.test(msg)) {
          skipped++;
        } else {
          errors.push({ sku: p.sku, error: msg });
        }
      }
    }

    res.json({ created, skipped, errors });
  } catch (err) {
    console.error('Import error', err);
    res.status(500).json({ error: 'Errore importazione CSV', details: err.message });
  }
});

// GET /api/products/export - returns CSV of all products
router.get('/export', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    const header = 'id,name,sku,price,stock,createdAt\n';
    const rows = products.map(p => `${p.id},"${p.name.replace(/"/g,'""')}",${p.sku || ''},${p.price},${p.stock},${p.createdAt.toISOString()}`).join('\n');
    const csv = header + rows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Export error', err);
    res.status(500).json({ error: 'Errore export prodotti' });
  }
});

// POST /api/products/import/raw (admin only) - accept raw CSV text in JSON { csv: '...' }
router.post('/import/raw', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'Nessun CSV fornito' });
    const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

    const productsToCreate = records.map((r, idx) => ({
      __row: idx + 1,
      name: r.name || '',
      sku: r.sku || null,
      price: isNaN(parseFloat(r.price)) ? null : parseFloat(r.price),
      stock: isNaN(parseInt(r.stock)) ? null : parseInt(r.stock),
    }));

    const validRows = [];
    const errors = [];
    productsToCreate.forEach((p) => {
      if (!p.name || !p.sku) {
        errors.push({ row: p.__row, error: 'Missing name or sku' });
        return;
      }
      if (p.price === null) {
        errors.push({ row: p.__row, error: 'Invalid price' });
        return;
      }
      if (p.stock === null) {
        errors.push({ row: p.__row, error: 'Invalid stock' });
        return;
      }
      validRows.push({ name: p.name, sku: p.sku, price: p.price, stock: p.stock });
    });

    if (validRows.length === 0) return res.status(400).json({ error: 'Nessun prodotto valido nel CSV', errors });

    try {
      const result = await prisma.product.createMany({ data: validRows, skipDuplicates: true });
      res.json({ created: result.count, skipped: validRows.length - result.count, errors });
      return;
    } catch (bulkErr) {
      console.error('createMany failed in import/raw, falling back', bulkErr);
    }

    let created = 0;
    let skipped = 0;
    for (const p of validRows) {
      try {
        await prisma.product.create({ data: p });
        created++;
      } catch (rowErr) {
        const msg = rowErr.message || String(rowErr);
        if (/Unique constraint failed on the fields|Unique constraint|Unique violation/i.test(msg)) {
          skipped++;
        } else {
          errors.push({ sku: p.sku, error: msg });
        }
      }
    }

    res.json({ created, skipped, errors });
  } catch (err) {
    console.error('Import raw error', err);
    res.status(500).json({ error: 'Errore importazione CSV', details: err.message });
  }
});

export default router;
