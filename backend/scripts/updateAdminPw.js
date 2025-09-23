import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
(async function(){
  try {
    const newHash = '$2b$10$kWvhGyVUF.gmjGRzFOD6yO5fM6uu1egpx2ZXt1ZEKqiKNBMUzLtui';
    await prisma.user.update({ where: { email: 'admin@test.com' }, data: { password: newHash } });
    const u = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
    console.log('updated', u.email);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
