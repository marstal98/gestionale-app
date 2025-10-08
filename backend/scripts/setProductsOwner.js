import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const adminId = 40; // admin from seed
    const prods = await prisma.product.findMany();
    console.log('Found products:', prods.length);
    for (const p of prods) {
      if (!p.createdById) {
        const updated = await prisma.product.update({ where: { id: p.id }, data: { createdById: adminId } });
        console.log('Updated product', p.id, '-> createdById', updated.createdById);
      } else {
        console.log('Skipping product', p.id, 'already has createdById', p.createdById);
      }
    }
  } catch (e) {
    console.error('Error setting owner', e);
  } finally {
    await prisma.$disconnect();
  }
})();
