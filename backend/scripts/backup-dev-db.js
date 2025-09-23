const fs = require('fs');
const path = require('path');
const src = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const dst = path.resolve(__dirname, '..', 'backups', 'dev.db.bak.' + new Date().toISOString().replace(/[:.]/g, '-'));
try {
  fs.copyFileSync(src, dst);
  console.log('created', dst);
} catch (e) {
  console.error('error', e.message);
  process.exit(1);
}
