import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { logApp, logAudit } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/assignments - list assignments (admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const assignments = await prisma.customerAssignment.findMany({ include: { customer: true, employee: true } });
    res.json(assignments);
  } catch (e) {
    console.error('GET /api/assignments error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/assignments - assign a customer to an employee (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { customerId, employeeId } = req.body;
    if (!customerId || !employeeId) return res.status(400).json({ error: 'customerId and employeeId required' });
    const cust = await prisma.user.findUnique({ where: { id: parseInt(customerId) } });
    const emp = await prisma.user.findUnique({ where: { id: parseInt(employeeId) } });
    if (!cust || !emp) return res.status(400).json({ error: 'User not found' });
    if (cust.role !== 'customer') return res.status(400).json({ error: 'customerId must be a customer' });
    if (emp.role !== 'employee' && emp.role !== 'admin') return res.status(400).json({ error: 'employeeId must be an employee or admin' });

    const created = await prisma.customerAssignment.create({ data: { customerId: cust.id, employeeId: emp.id } });
    try { logAudit('assign', 'customer', created.id, req.user || {}, { customerId: cust.id, employeeId: emp.id }); } catch (e) { console.error('Audit log error', e); }
    logApp('assignment.create', { id: created.id, customerId: cust.id, employeeId: emp.id, by: req.user?.id || null });
    res.status(201).json(created);
  } catch (e) {
    console.error('POST /api/assignments error', e);
    if (String(e.message || '').includes('Unique constraint')) return res.status(409).json({ error: 'Assignment already exists' });
    res.status(500).json({ error: 'Errore server' });
  }
});

// DELETE /api/assignments - remove assignment (admin only) by payload customerId+employeeId
router.delete('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { customerId, employeeId } = req.body;
    if (!customerId || !employeeId) return res.status(400).json({ error: 'customerId and employeeId required' });
    const existing = await prisma.customerAssignment.findUnique({ where: { customerId_employeeId: { customerId: parseInt(customerId), employeeId: parseInt(employeeId) } } });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });
    await prisma.customerAssignment.delete({ where: { id: existing.id } });
    try { logAudit('unassign', 'customer', existing.id, req.user || {}, { customerId: existing.customerId, employeeId: existing.employeeId }); } catch (e) { console.error('Audit log error', e); }
    logApp('assignment.delete', { id: existing.id, customerId: existing.customerId, employeeId: existing.employeeId, by: req.user?.id || null });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/assignments error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

export default router;
