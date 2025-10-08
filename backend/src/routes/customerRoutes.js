import express from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { authenticateToken } from '../middleware/auth.js'
import { logApp, logAudit } from '../utils/logger.js'
import { sendMail } from '../utils/mailer.js';
import emailTemplates from '../utils/emailTemplates.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/customers - create a customer account (allowed for employee and admin)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const requester = req.user;
    if (!requester) return res.status(401).json({ error: 'Not authenticated' });
    if (!['employee','admin'].includes(String(requester.role))) return res.status(403).json({ error: 'Permesso negato' });

    const { name, email, phone } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email richiesta' });
    const trimmed = String(email).trim().toLowerCase();

    // check duplicate
    const existing = await prisma.user.findUnique({ where: { email: trimmed } });
    if (existing) {
      // do not expose sensitive fields
      return res.status(409).json({ error: 'Email esistente', existing: true, user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role } });
    }

    // Create a disabled user and create an Invitation token so the customer
    // can accept the invite and set their password. This is the safer
    // production-friendly flow (email invite, no plaintext passwords returned).
    const crypto = await import('crypto');
    // provisional temporary password (not returned in production emails, used only for dev logs if needed)
    const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) + '!';
    const hashed = await bcrypt.hash(tempPassword, 10);

    const created = await prisma.user.create({ data: { name: name || '', email: trimmed, password: hashed, role: 'customer', isActive: false, createdById: requester.id } });
    try { logAudit('create', 'user', created.id, requester || {}, { name: created.name, email: created.email, role: created.role, invited: true }); } catch (e) { console.error('Audit log error', e); }
    logApp('customer.create.invited', { id: created.id, by: requester.id });

    // generate invitation token and persist it
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24h
    const invitation = await prisma.invitation.create({ data: { email: trimmed, token, userId: created.id, createdById: requester.id, expiresAt } });

    // send invite email (non-blocking)
    try {
      const mail = emailTemplates.inviteTemplate({ token, email: trimmed }, { tempPassword: tempPassword });
      sendMail({ to: trimmed, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from }).catch(e => console.error('Invite mail failed', e));
      logApp('customer.invite.email.sent', { to: trimmed, invitationId: invitation.id, userId: created.id });
    } catch (e) {
      console.error('Invite email template error', e);
      logApp('customer.invite.email.failed', { to: trimmed, error: String(e) });
    }

    // Return safe object: do not include passwords. Client should show a confirmation message.
    const safe = { id: created.id, name: created.name, email: created.email, role: created.role, invited: true };
    res.status(201).json(safe);
  } catch (e) {
    console.error('Create customer error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

export default router;
