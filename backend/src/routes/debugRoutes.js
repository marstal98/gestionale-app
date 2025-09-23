import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const router = express.Router();

router.get('/dbinfo', (req, res) => {
  const dbUrl = process.env.DATABASE_URL || null;
  let resolved = null;
  try {
    if (dbUrl && dbUrl.startsWith('file:')) {
      const p = dbUrl.replace('file:', '');
      resolved = path.resolve(process.cwd(), p);
    }
  } catch (e) { /* ignore */ }
  res.json({ cwd: process.cwd(), DATABASE_URL: dbUrl, resolvedPath: resolved });
});

router.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), host: req.hostname });
});

export default router;
