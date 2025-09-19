import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(){
  const p = await prisma.product.findUnique({ where: { id: 1 } });
  console.log('product1', p);
  await prisma.$disconnect();
}

main().catch(e=>{console.error(e); process.exit(1)})
