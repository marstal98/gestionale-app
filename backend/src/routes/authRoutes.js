import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { sendMail } from '../utils/mailer.js';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware: verifica JWT e ruolo admin
function authAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token mancante" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Token non valido" });
    if (decoded.role !== "admin") return res.status(403).json({ error: "Accesso negato" });

    req.user = decoded;
    next();
  });
}

// POST /api/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Credenziali non valide" });

  // prevent login for disabled users
  if (user.isActive === false) return res.status(403).json({ error: 'Utente disabilitato' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Credenziali non valide" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // create refresh token (longer expiry)
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d' });

  res.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
  });
});

// POST /api/auth/request-reset - request a password reset email
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email mancante' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(200).json({ ok: true }); // do not reveal existence

    // create a short lived token for reset
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      try {
    const tpl = await import('../utils/emailTemplates.js');
    // Pass only the token; templates will provide textual instructions (no external links)
    const mail = tpl.resetRequestTemplate(user, { token });
    await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from });
      } catch (e) { console.error('Reset request template error', e); }
    res.json({ ok: true });
  } catch (e) {
    console.error('Request reset error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/auth/reset - perform password reset with token
router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token e nuova password richiesti' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'newPassword must be at least 8 chars' });
  try {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(400).json({ error: 'Token non valido o scaduto' });
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(404).json({ error: 'Utente non trovato' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
      // send notification email
      try {
        const tpl = await import('../utils/emailTemplates.js');
        const mail = tpl.passwordChangedTemplate(user);
        await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from });
      } catch (e) { console.error('Mail after reset failed', e); }
      res.json({ ok: true });
    });
  } catch (e) {
    console.error('Reset error', e);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/auth/refresh - exchange refresh token for a new access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token mancante' });
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  jwt.verify(refreshToken, refreshSecret, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Refresh token non valido' });
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(404).json({ error: 'Utente non trovato' });
      if (user.isActive === false) return res.status(403).json({ error: 'Utente disabilitato' });
      const newToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: newToken });
    } catch (e) {
      console.error('Refresh error', e);
      res.status(500).json({ error: 'Errore server' });
    }
  });
});

// GET /api/users (solo admin)
router.get("/users", authAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server" });
  }
});

// POST /api/users → Crea nuovo utente (solo admin)
router.post("/users", authAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
  }

  try {
    // Controllo se l'email esiste già
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const safeExisting = { id: existing.id, name: existing.name, email: existing.email, role: existing.role, isActive: existing.isActive };
      return res.status(409).json({ error: 'Email esistente', existing: true, user: safeExisting });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, createdById: req.user?.id || null },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server" });
  }
});


export default router;
