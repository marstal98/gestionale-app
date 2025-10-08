import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Check if an email is already present in users table.
 * Returns null if not present, otherwise returns a safe user object.
 */
export async function findExistingByEmail(email) {
  if (!email) return null;
  const e = await prisma.user.findUnique({ where: { email } });
  if (!e) return null;
  return { id: e.id, name: e.name, email: e.email, role: e.role, isActive: e.isActive };
}

export default { findExistingByEmail };
