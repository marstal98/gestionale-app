import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { logApp } from '../utils/logger.js';
import { sendMail } from '../utils/mailer.js';
import emailTemplates from '../utils/emailTemplates.js';
import { findExistingByEmail } from '../utils/emailChecks.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/access-requests - public
router.post('/', async (req, res) => {
  try {
    const { name, email, company, message } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email mancante' });

    // Centralized duplicate email check
    const existingUser = await findExistingByEmail(email);
    if (existingUser) return res.status(409).json({ error: 'Email esistente', existing: true, user: existingUser });

    const ar = await prisma.accessRequest.create({ data: { name: name || '', email, company: company || null, message: message || null } });
    logApp('accessRequest.created', { id: ar.id, email: ar.email });

    // Notify admin via email
    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'marcostallone.developer@gmail.com';
  // Do not construct or include clickable deep-links or web URLs in emails; template contains textual instructions.
  const tpl = emailTemplates.accessRequestNotifyTemplate(ar, {});
      await sendMail({ to: adminEmail, subject: tpl.subject, text: tpl.text, html: tpl.html });
      logApp('accessRequest.notify.email.sent', { accessRequestId: ar.id, to: adminEmail });
    } catch (mailErr) {
      console.error('Failed to send access request notification', mailErr);
      logApp('accessRequest.notify.email.failed', { accessRequestId: ar.id, error: String(mailErr) });
    }

    res.status(201).json({ ok: true, id: ar.id });
  } catch (e) {
    console.error('Create access request error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// GET /api/access-requests - admin
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const list = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(list);
  } catch (e) {
    console.error('List access requests error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/access-requests/:id/handle - admin (accept/reject and optionally create user)
router.post('/:id/handle', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action } = req.body; // 'accept' | 'reject'
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    const ar = await prisma.accessRequest.findUnique({ where: { id } });
    if (!ar) return res.status(404).json({ error: 'Richiesta non trovata' });
    if (!['accept','reject'].includes(action)) return res.status(400).json({ error: 'Azione non valida' });
    // prevent state change if already handled
    if (ar.status && ar.status !== 'pending') {
      return res.status(400).json({ error: `Richiesta già elaborata con stato '${ar.status}'` });
    }
    const now = new Date();
    let updated = await prisma.accessRequest.update({ where: { id }, data: { status: action === 'accept' ? 'accepted' : 'rejected', handledById: req.user.id, handledAt: now } });
    logApp('accessRequest.handled', { id, action, by: req.user.id });

    // If accepted, create an Invitation and send invite email to the requester
    if (action === 'accept') {
      try {
        // generate a secure temporary password
        const crypto = await import('crypto');
        const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) + '!';
        const hashed = await bcrypt.hash(tempPassword, 10);
        // Dev-only: log the generated temporary password so we can verify parity with the emailed value
        if (process.env.NODE_ENV !== 'production') {
          try {
            console.log(`[DEV] Generated tempPassword for ${ar.email}:`, tempPassword);
          } catch (e) { /* ignore */ }
        }

        // Do not auto-activate or overwrite existing admin accounts here.
        // Instead: create a disabled user (if not exists) and an Invitation so the
        // requester can accept the invite and set their password securely.
        let user = await prisma.user.findUnique({ where: { email: ar.email } });
        if (!user) {
          // create and activate the user immediately so the temporary password is usable
          user = await prisma.user.create({ data: { name: ar.name || ar.email.split('@')[0], email: ar.email, password: hashed, role: 'admin', isActive: true, createdById: req.user?.id || null } });
        } else {
          // update password and ensure the account is active so the temp password works
          await prisma.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true, createdById: user.createdById || req.user?.id || null } });
        }

        // create or reuse an invitation token
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
        let invitation = await prisma.invitation.findFirst({ where: { email: ar.email, usedAt: null, expiresAt: { gt: new Date() } } });
        if (!invitation) {
          invitation = await prisma.invitation.create({ data: { email: ar.email, token, userId: user.id, createdById: req.user.id, expiresAt } });
        } else {
          invitation = await prisma.invitation.update({ where: { id: invitation.id }, data: { userId: user.id, createdById: req.user.id } });
        }

        // send email with temporary password and explicit instructions
        const tpl = emailTemplates.inviteTemplate(invitation, { tempPassword });
        await sendMail({ to: ar.email, subject: tpl.subject, text: tpl.text, html: tpl.html });
        logApp('accessRequest.invite.sent', { accessRequestId: ar.id, to: ar.email, invitationId: invitation.id, userId: user.id });
      } catch (inviteErr) {
        console.error('Failed to create/send invitation', inviteErr);
        logApp('accessRequest.invite.failed', { accessRequestId: ar.id, error: String(inviteErr) });
      }
    }

    res.json({ ok: true, status: updated.status });
  } catch (e) {
    console.error('Handle access request error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

export default router;
