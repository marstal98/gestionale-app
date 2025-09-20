#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Usage: node prettyLogs.js [audit|app] [lines]
const args = process.argv.slice(2);
const which = args[0] || 'audit';
const lines = parseInt(args[1] || '50', 10);

const logsDir = path.resolve(process.cwd(), 'backend', 'logs');
const filePath = which === 'app' ? path.join(logsDir, 'app.log') : path.join(logsDir, 'audit.log');

function tailFile(fp, n) {
  if (!fs.existsSync(fp)) return [];
  const data = fs.readFileSync(fp, 'utf8');
  const arr = data.split(/\r?\n/).filter(Boolean);
  return arr.slice(-n);
}

function prettyPrintLine(line) {
  try {
    const obj = JSON.parse(line);
    const ts = obj.ts || '';
    const lvl = obj.level || '';
    const event = obj.event || '';
    const details = obj.details || {};
    const meta = obj.meta || {};

    // Build actor summary if present
    let actorStr = '';
    if (details && details.actor) {
      actorStr = ` by ${details.actor.email || details.actor.id || ''}`;
    } else if (details && details.by) {
      actorStr = ` by id=${details.by}`;
    }

    // human friendly subject
    const subj = details && details.subjectType ? `${details.subjectType}:${details.subjectId || ''}` : '';

    console.log(`${ts} [${lvl}] ${event} ${subj}${actorStr}`);
    // print details nicely
    const dump = Object.assign({}, details);
    // remove redundant actor if already printed
    if (dump.actor) delete dump.actor;
    if (dump.by) delete dump.by;
    if (Object.keys(dump).length) console.log('  ->', JSON.stringify(dump, null, 2));
    if (Object.keys(meta || {}).length) console.log('  meta:', JSON.stringify(meta));
  } catch (e) {
    console.log('RAW:', line);
  }
}

const linesArr = tailFile(filePath, lines);
if (linesArr.length === 0) {
  console.log(`No logs found in ${filePath}`);
  process.exit(0);
}

for (const l of linesArr) {
  prettyPrintLine(l);
  console.log('');
}
