import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { logApp, logAudit } from '../utils/logger.js';
import { findExistingByEmail } from '../utils/emailChecks.js';
import { sendMail } from '../utils/mailer.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET: lista utenti — ogni utente vede se stesso e i suoi sottoposti (multi-level).
router.get("/", authenticateToken, async (req, res) => {
  try {
    const requester = req.user;
    console.log('DEBUG GET /api/users - requester:', requester && { id: requester.id, role: requester.role, email: requester.email });
    if (!requester) return res.status(401).json({ error: 'Not authenticated' });

    // if superadmin (email check against frontend constant) allow all
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || '';
    if (requester && requester.email && requester.email.toLowerCase() === (SUPERADMIN_EMAIL || '').toLowerCase()) {
      const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true } });
      return res.json(users);
    }

    // If customer: only themselves
    if (requester.role === 'customer') {
      const u = await prisma.user.findUnique({ where: { id: requester.id }, select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true } });
      return res.json(u ? [u] : []);
    }

    // For admin and employee: collect recursive subordinates (multi-level)
  console.log('DEBUG GET /api/users - collecting subordinates for requester id', requester.id);
    const subordinateIds = [];
    const queue = [requester.id];
    while (queue.length) {
      const parentId = queue.shift();
      const children = await prisma.user.findMany({ where: { createdById: parentId }, select: { id: true } });
      for (const c of children) {
        if (!subordinateIds.includes(c.id) && c.id !== requester.id) {
          subordinateIds.push(c.id);
          queue.push(c.id);
        }
      }
    }

    // customers assigned to any subordinate employees
    const assigned = subordinateIds.length ? await prisma.customerAssignment.findMany({ where: { employeeId: { in: subordinateIds } }, select: { customerId: true } }) : [];
    const assignedCustomerIds = assigned.map(a => a.customerId);

    const users = await prisma.user.findMany({
      where: { OR: [ { id: requester.id }, { id: { in: subordinateIds } }, { id: { in: assignedCustomerIds } } ] },
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true }
    });
    console.log('DEBUG GET /api/users - subordinateIds:', subordinateIds, 'assignedCustomerIds:', assignedCustomerIds);
    return res.json(users);
  } catch (err) {
    console.error('GET /api/users error:', err);
    return res.status(500).json({ error: "Errore server" });
  }
});

// POST: crea nuovo utente (solo admin)
router.post("/", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Prevent duplicate emails
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const safeExisting = { id: existingUser.id, name: existingUser.name, email: existingUser.email, role: existingUser.role, isActive: existingUser.isActive };
      return res.status(409).json({ error: 'Email esistente', existing: true, user: safeExisting });
    }

    // If admin provided a password explicitly, keep legacy behavior (for ops/CLI convenience)
    if (password && typeof password === 'string' && password.length >= 8) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({ data: { name, email, password: hashedPassword, role, createdById: req.user?.id || null } });
      const safe = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, createdAt: newUser.createdAt, isActive: newUser.isActive };
      try { logAudit('create', 'user', newUser.id, req.user || {}, { name: newUser.name, email: newUser.email, role: newUser.role }); } catch (e) { console.error('Audit log error', e); }
      logApp('user.create', { userId: newUser.id, by: req.user?.id || null });
      res.json(safe);
      return;
    }

    // Otherwise: create a disabled user and send an invitation to set password
    const provisionalPassword = Math.random().toString(36).slice(2, 10) + '!'; // temporary hash
    const hashed = await bcrypt.hash(provisionalPassword, 10);
    const newUser = await prisma.user.create({ data: { name: name || '', email, password: hashed, role, isActive: false, createdById: req.user?.id || null } });

    // create or reuse invitation token
    const crypto = require('crypto');
    const now = new Date();
    let invitation = await prisma.invitation.findFirst({ where: { email, usedAt: null, expiresAt: { gt: now } } });
    if (!invitation) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24h
      invitation = await prisma.invitation.create({ data: { email, token, userId: newUser.id, createdById: req.user?.id || null, expiresAt } });
    } else {
      // link invitation to the newly created user
      invitation = await prisma.invitation.update({ where: { id: invitation.id }, data: { userId: newUser.id, createdById: req.user?.id || null } });
    }

    // send invite email with the provisional temporary password (instructions to change it)
    try {
      const tpl = await import('../utils/emailTemplates.js');
      const mail = tpl.inviteTemplate({ token: invitation.token, email }, { tempPassword: provisionalPassword });
      sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from }).catch(e => console.error('Invite mail failed', e));
    } catch (e) { console.error('Invite mail template error', e); }

    // audit log
    try { logAudit('create', 'user', newUser.id, req.user || {}, { name: newUser.name, email: newUser.email, role: newUser.role, invited: true }); } catch (e) { console.error('Audit log error', e); }
    logApp('user.create.invited', { userId: newUser.id, by: req.user?.id || null });
    const safe = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, createdAt: newUser.createdAt, isActive: newUser.isActive };
    res.json(safe);
  } catch (err) {
    console.error('Create user error', err);
    res.status(500).json({ error: "Errore creazione utente" });
  }
});

// PUT: modifica utente (solo admin)
router.put("/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    const updateData = { name, email, role };

    // If email is being changed, ensure it doesn't collide with another user
    if (email) {
      const existing = await findExistingByEmail(email);
      if (existing && existing.id !== parseInt(id)) return res.status(409).json({ error: 'Email esistente', existing: true, user: existing });
    }

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
    // Notify user if email changed or role changed to customer
    (async () => {
      try {
        const tpl = await import('../utils/emailTemplates.js');
        // If email changed, send a notification to the new email
        if (email && email !== req.user?.email && updatedUser.email) {
          try {
            const mail = tpl.welcomeTemplate(updatedUser);
            sendMail({ to: updatedUser.email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from }).catch(e => console.error('User update welcome mail failed', e));
          } catch (e) { console.error('User update welcome template error', e); }
        }
        // If role changed to customer, ensure they receive a welcome-like notice
        if (role === 'customer') {
          try {
            const mail = tpl.welcomeTemplate(updatedUser);
            sendMail({ to: updatedUser.email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from }).catch(e => console.error('User role-change mail failed', e));
          } catch (e) { console.error('Role-change template error', e); }
        }
      } catch (e) { console.error('Background notification error (user update)', e); }
    })();

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
  // notify the user about activation status change
  (async () => {
    try {
      if (updated.email) {
        const tpl = await import('../utils/emailTemplates.js');
        const subject = updated.isActive ? `Account attivato - GestioNexus` : `Account disattivato - GestioNexus`;
        const text = updated.isActive ? `Ciao ${updated.name || ''},\n\nIl tuo account è stato attivato. Puoi effettuare il login.` : `Ciao ${updated.name || ''},\n\nIl tuo account è stato disattivato. Se pensi sia un errore, contatta l'amministratore.`;
        await sendMail({ to: updated.email, subject, text });
      }
    } catch (e) { console.error('Activation notification failed', e); }
  })();

  res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore aggiornamento stato utente' });
  }
});

// POST: change password for current user
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword are required' });
    if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'newPassword must be at least 8 characters' });

    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return res.status(404).json({ error: 'Utente non trovato' });

    const match = await bcrypt.compare(oldPassword, existing.password);
    if (!match) return res.status(401).json({ error: 'Password attuale non corretta' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    try { logAudit('change-password', 'user', userId, req.user || {}, {}); } catch (e) { console.error('Audit log error', e); }
    logApp('user.changePassword', { userId, by: req.user?.id || null });
    // notify user by email (non-blocking)
    try { sendMail({ to: existing.email, subject: 'Password modificata', text: 'La tua password è stata modificata. Se non sei stato tu, contatta il supporto.' }).catch(e => console.error('Change password mail failed', e)); } catch (e) { console.error('Mail send error', e); }
    // client should force logout to invalidate local tokens
    res.json({ ok: true, forceLogout: true });
  } catch (err) {
    console.error('Change password error', err);
    res.status(500).json({ error: 'Errore cambio password' });
  }
});

export default router;

// POST: send a simple test email to the currently authenticated user
router.post('/send-test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u || !u.email) return res.status(400).json({ error: 'No user email' });
    const subject = 'GestioNexus - Email di test';
    const text = `Ciao ${u.name || ''}, questa è una mail di test inviata dal sistema.`;
    await sendMail({ to: u.email, subject, text });
    res.json({ ok: true });
  } catch (err) {
    console.error('Send-test error', err);
    res.status(500).json({ error: 'Invio mail di test fallito' });
  }
});
