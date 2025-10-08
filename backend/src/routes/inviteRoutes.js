import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js';
import { logApp } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/invite/status?token=...  - check token validity
router.get('/status', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token mancante' });
    const inv = await prisma.invitation.findUnique({ where: { token: String(token) } });
    if (!inv) return res.status(404).json({ error: 'Token non valido' });
    if (inv.usedAt) return res.status(400).json({ error: 'Token già usato' });
    if (new Date() > inv.expiresAt) return res.status(400).json({ error: 'Token scaduto' });
    res.json({ ok: true, email: inv.email });
  } catch (e) {
    console.error('Invite status error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/invite/accept { token, password }
router.post('/accept', async (req, res) => {
  try {
    const { token, password, name } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token e password richiesti' });
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'password troppo corta' });
    const inv = await prisma.invitation.findUnique({ where: { token: String(token) } });
    if (!inv) return res.status(400).json({ error: 'Token non valido' });
    if (inv.usedAt) return res.status(400).json({ error: 'Token già usato' });
    if (new Date() > inv.expiresAt) return res.status(400).json({ error: 'Token scaduto' });

    // create user if not exists
    let user = null;
    user = await prisma.user.findUnique({ where: { email: inv.email } });
    const hashed = await bcrypt.hash(password, 10);
    if (!user) {
      user = await prisma.user.create({ data: { name: name || inv.email.split('@')[0], email: inv.email, password: hashed, role: 'admin', isActive: true } });
    } else {
      // update password and activate
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true } });
    }

    // mark invitation used
    await prisma.invitation.update({ where: { id: inv.id }, data: { usedAt: new Date(), userId: user.id } });
    logApp('invite.accepted', { invitationId: inv.id, userId: user.id });
    // return token for immediate login
    const tokenJwt = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token: tokenJwt, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error('Invite accept error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

export default router;
