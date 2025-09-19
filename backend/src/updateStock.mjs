import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(){
  console.log('--- READ BEFORE ---');
  let p = await prisma.product.findUnique({ where: { id: 1 } });
  console.log(p);

  console.log('--- UPDATEMANY decrement 1 ---');
  const res = await prisma.product.updateMany({ where: { id: 1, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
  console.log('updateMany result:', res);

  console.log('--- READ AFTER ---');
  p = await prisma.product.findUnique({ where: { id: 1 } });
  console.log(p);

  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
