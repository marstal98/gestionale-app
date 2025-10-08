import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const prods = await prisma.product.findMany();
  console.log(JSON.stringify(prods, null, 2));
  await prisma.$disconnect();
})();
