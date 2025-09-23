import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const dst = path.resolve(__dirname, '..', 'backups', 'dev.db.bak.' + new Date().toISOString().replace(/[:.]/g, '-'));

try {
  fs.copyFileSync(src, dst);
  console.log('created', dst);
} catch (e) {
  console.error('error', e.message);
  process.exit(1);
}
