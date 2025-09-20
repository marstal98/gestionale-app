import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  { name: 'Prodotto Alpha', sku: 'P001', price: 9.9, stock: 50 },
  { name: 'Prodotto Beta', sku: 'P002', price: 14.5, stock: 30 },
  { name: 'Prodotto Gamma', sku: 'P003', price: 7.25, stock: 120 },
  { name: 'Prodotto Delta', sku: 'P004', price: 19.99, stock: 10 },
  { name: 'Prodotto Epsilon', sku: 'P005', price: 4.5, stock: 200 },
  { name: 'Prodotto Zeta', sku: 'P006', price: 29.0, stock: 5 },
  { name: 'Prodotto Eta', sku: 'P007', price: 12.0, stock: 40 },
  { name: 'Prodotto Theta', sku: 'P008', price: 3.99, stock: 300 },
  { name: 'Prodotto Iota', sku: 'P009', price: 49.9, stock: 2 },
  { name: 'Prodotto Kappa', sku: 'P010', price: 6.75, stock: 80 }
];

async function main() {
  console.log('Seeding products...');
  for (const p of products) {
    try {
      const up = await prisma.product.upsert({
        where: { sku: p.sku },
        update: { name: p.name, price: p.price, stock: p.stock },
        create: p
      });
      console.log('Upserted:', up.sku, up.id);
    } catch (err) {
      console.error('Failed upsert for', p.sku, err.message || err);
    }
  }
  const count = await prisma.product.count();
  console.log('Total products in DB:', count);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
