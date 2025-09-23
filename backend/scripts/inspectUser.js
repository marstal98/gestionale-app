import { PrismaClient } from '@prisma/client';

(async function(){
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
    console.log(JSON.stringify(u, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
