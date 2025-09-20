import fs from 'fs';
import path from 'path';

const logsDir = path.resolve(process.cwd(), 'backend', 'logs');
if (!fs.existsSync(logsDir)) {
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) { console.error('Impossibile creare la directory dei log', e); }
}

const auditLogPath = path.join(logsDir, 'audit.log');

function safeWrite(filePath, content) {
  try {
    fs.appendFileSync(filePath, content + '\n', { encoding: 'utf8' });
  } catch (e) {
    // fallback to console if file write fails
    console.error('Scrittura log fallita', e, content);
  }
}

function formatHumanAudit(action, subjectType, subjectId, actor = {}, details = {}) {
  const ts = new Date().toISOString();
  const lines = [];
  lines.push('=== AZIONE DI AUDIT ===');
  lines.push(`Timestamp: ${ts}`);
  lines.push(`Azione: ${action}`);
  lines.push(`Soggetto: ${subjectType}${subjectId ? ` (id=${subjectId})` : ''}`);
  lines.push(`Eseguito da: id=${actor.id || 'n/a'}${actor.email ? ` - ${actor.email}` : ''}${actor.role ? ` - ruolo=${actor.role}` : ''}`);
  if (details && Object.keys(details).length) {
    lines.push('Dettagli:');
    const pretty = JSON.stringify(details, null, 2);
    lines.push(pretty);
  }
  lines.push('-------------------------------');
  return lines.join('\n');
}

export function logAudit(action, subjectType, subjectId, actor = {}, details = {}) {
  try {
    const human = formatHumanAudit(action, subjectType, subjectId, actor, details);
    safeWrite(auditLogPath, human);
  } catch (e) {
    console.error('Errore logAudit', e);
  }
}

// lightweight application log: kept for compatibility with existing calls
export function logApp(event, payload = {}, actor = {}) {
  try {
    const ts = new Date().toISOString();
    const lines = [];
    lines.push('=== APP LOG ===');
    lines.push(`Timestamp: ${ts}`);
    lines.push(`Evento: ${event}`);
    if (actor && Object.keys(actor).length) {
      lines.push(`Eseguito da: id=${actor.id || 'n/a'}${actor.email ? ` - ${actor.email}` : ''}`);
    }
    if (payload && Object.keys(payload).length) {
      lines.push('Dati:');
      lines.push(JSON.stringify(payload, null, 2));
    }
    lines.push('-------------------------------');
    safeWrite(auditLogPath, lines.join('\n'));
  } catch (e) {
    console.error('Errore logApp', e);
  }
}

export default { logAudit, logApp };
