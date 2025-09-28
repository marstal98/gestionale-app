import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { logApp } from './logger.js';

const logsDir = path.resolve(process.cwd(), 'backend', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const mailLogPath = path.join(logsDir, 'mail.log');

// Legacy single-line email.log removed. We keep only the structured mail.log

function appendMailLogStructured({ event, to, from, subject, text, html, info, error }) {
  const now = new Date();
  const header = `--- ${event.toUpperCase()} ${now.toISOString()} ---`;
  const lines = [header];
  if (to) lines.push(`To: ${to}`);
  if (from) lines.push(`From: ${from}`);
  if (subject) lines.push(`Subject: ${subject}`);
  lines.push(`Event: ${event}`);
  if (text) {
    lines.push('Text:');
    lines.push(text.split('\n').map(l => '  ' + l).join('\n'));
  }
  if (html) lines.push('HTML: (present)');
  if (info) {
    try { lines.push(`Info: ${typeof info === 'string' ? info : JSON.stringify(info, null, 2)}`); } catch (e) { lines.push(`Info: ${String(info)}`); }
  }
  if (error) {
    lines.push('Error:');
    lines.push(String(error).split('\n').map(l => '  ' + l).join('\n'));
  }
  lines.push('--- end ---\n');
  try {
    fs.appendFileSync(mailLogPath, lines.join('\n') + '\n', { encoding: 'utf8' });
  } catch (e) {
    console.error('Failed to write mail.log', e);
  }
}

let transporter = null;

function initTransporter() {
  if (transporter) return transporter;
  // prefer explicit SMTP env vars
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    appendMailLogStructured({ event: 'init', info: { host, port, user: user ? String(user).replace(/.(?=.{3})/g, '*') : null, mode: 'smtp' } });
    return transporter;
  }

  // dev fallback: create test account via Ethereal
  try {
    // nodemailer.createTestAccount is async; create a transporter that logs to console if not configured
  transporter = nodemailer.createTransport({ jsonTransport: true });
  appendMailLogStructured({ event: 'init', info: { mode: 'jsonTransport', note: 'dev fallback' } });
    return transporter;
  } catch (e) {
    console.error('Failed to init mail transporter', e);
    appendEmailLog('[MAILER] Failed to init transporter: ' + String(e));
    throw e;
  }
}

export async function sendMail({ to, subject, text, html, from }) {
  const t = initTransporter();
  const msg = { from: from || process.env.MAIL_FROM || 'no-reply@example.com', to, subject, text, html };
  const ts = new Date().toISOString();
  // write a human-friendly detailed mail.log entry (single source)
  appendMailLogStructured({ event: 'attempt', to, from: msg.from, subject, text, html, info: { timestamp: ts } });
  try {
    const info = await t.sendMail(msg);
    appendMailLogStructured({ event: 'sent', to, from: msg.from, subject, info });
    logApp('email.sent', { to, subject, info });
    return info;
  } catch (err) {
    appendMailLogStructured({ event: 'failed', to, from: msg.from, subject, error: err });
    console.error('sendMail error', err);
    logApp('email.failed', { to, subject, error: String(err) });
    throw err;
  }
}

export default { sendMail };
