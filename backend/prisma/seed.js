import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // use upsert to avoid relying on skipDuplicates (compatibility across Prisma versions)
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@test.com', password: passwordHash, role: 'admin' }
  });
  await prisma.user.upsert({
    where: { email: 'employee@test.com' },
    update: {},
    create: { name: 'Employee User', email: 'employee@test.com', password: passwordHash, role: 'employee' }
  });
  await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: { name: 'Customer User', email: 'customer@test.com', password: passwordHash, role: 'customer' }
  });

  // additional sample customers
  const sampleCustomers = [
    { name: 'Luca Rossi', email: 'luca.rossi@test.com' },
    { name: 'Giulia Bianchi', email: 'giulia.bianchi@test.com' },
    { name: 'Marco Verdi', email: 'marco.verdi@test.com' }
  ];

  for (const c of sampleCustomers) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { name: c.name, email: c.email, password: passwordHash, role: 'customer' }
    });
  }

  // seed prodotti
  await prisma.product.upsert({
    where: { sku: 'A-100' },
    update: {},
    create: { name: 'Prodotto A', sku: 'A-100', price: 9.99, stock: 100 }
  });
  await prisma.product.upsert({
    where: { sku: 'B-200' },
    update: {},
    create: { name: 'Prodotto B', sku: 'B-200', price: 19.99, stock: 50 }
  });

  // sample order (best-effort: only if customer exists and products exist)
  const customer = await prisma.user.findUnique({ where: { email: 'customer@test.com' } });
  const prodA = await prisma.product.findUnique({ where: { sku: 'A-100' } });
  const prodB = await prisma.product.findUnique({ where: { sku: 'B-200' } });

  if (customer && prodA && prodB) {
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        createdById: customer.id,
        total: 29.98,
        status: 'completed',
        items: {
          create: [
            { productId: prodA.id, quantity: 1, unitPrice: prodA.price },
            { productId: prodB.id, quantity: 1, unitPrice: prodB.price },
          ],
        },
      },
      include: { items: true }
    });
  }
}

main()
  .then(() => console.log("✅ Utenti seed creati"))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
