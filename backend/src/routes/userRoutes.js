import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { logApp, logAudit } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET: lista utenti (solo admin)
router.get("/", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true }
    });
    res.json(users);
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: "Errore server" });
  }
});

// POST: crea nuovo utente (solo admin)
router.post("/", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role }
    });
    // do not return password hash
    const safe = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, createdAt: newUser.createdAt, isActive: newUser.isActive };
    // audit log
    try { logAudit('create', 'user', newUser.id, req.user || {}, { name: newUser.name, email: newUser.email, role: newUser.role }); } catch (e) { console.error('Audit log error', e); }
    logApp('user.create', { userId: newUser.id, by: req.user?.id || null });
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "Errore creazione utente" });
  }
});

// PUT: modifica utente (solo admin)
router.put("/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    const updateData = { name, email, role };

    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    const safe = { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, createdAt: updatedUser.createdAt, isActive: updatedUser.isActive };
    try { logAudit('update', 'user', updatedUser.id, req.user || {}, { updatedFields: Object.keys(updateData) }); } catch (e) { console.error('Audit log error', e); }
    logApp('user.update', { userId: updatedUser.id, by: req.user?.id || null });
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore aggiornamento utente" });
  }
});

// DELETE: elimina utente (solo admin)
router.delete("/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting their own account
  if (req.user && req.user.id === parseInt(id)) {
    return res.status(400).json({ error: "Non puoi eliminare il tuo account" });
  }

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    try { logAudit('delete', 'user', parseInt(id), req.user || {}, {}); } catch (e) { console.error('Audit log error', e); }
    logApp('user.delete', { userId: parseInt(id), by: req.user?.id || null });
    res.json({ message: "Utente eliminato" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione utente" });
  }
});

// PUT: toggle isActive (enable/disable user)
router.put("/:id/activate", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  // Prevent admin from disabling/enabling their own account
  if (req.user && req.user.id === parseInt(id)) {
    return res.status(400).json({ error: "Non puoi modificare lo stato del tuo account" });
  }
  try {
    const updated = await prisma.user.update({ where: { id: parseInt(id) }, data: { isActive: Boolean(isActive) } });
    const safe = { id: updated.id, name: updated.name, email: updated.email, role: updated.role, createdAt: updated.createdAt, isActive: updated.isActive };
  try { logAudit(isActive ? 'activate' : 'deactivate', 'user', updated.id, req.user || {}, { isActive: updated.isActive }); } catch (e) { console.error('Audit log error', e); }
  logApp('user.activate', { userId: updated.id, by: req.user?.id || null, isActive: updated.isActive });
  res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore aggiornamento stato utente' });
  }
});

export default router;
