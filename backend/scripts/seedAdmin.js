import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@local';
  const password = process.env.SEED_ADMIN_PW || 'admin123';
  const name = 'Administrator';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed, role: 'admin' } });
  console.log('Created admin user:', { id: user.id, email: user.email });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
