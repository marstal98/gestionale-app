import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Determine whether a requester can view a given customerId
 * - admin: can view if superadmin OR created the customer OR customer assigned to admin's subordinates
 * - employee: can view if assigned to them
 * - customer: can view only themselves
 */
export async function canViewCustomer(requester, customerId) {
  if (!requester) return false;
  if (requester.role === 'admin') {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || '';
    if (requester.email && requester.email.toLowerCase() === (SUPERADMIN_EMAIL || '').toLowerCase()) return true;
    if (requester.id === customerId) return true;
    // direct subordinates
    const subs = await prisma.user.findMany({ where: { createdById: requester.id }, select: { id: true } });
    const subordinateIds = subs.map(s => s.id);
    const cust = await prisma.user.findUnique({ where: { id: customerId } });
    if (!cust) return false;
    if (cust.createdById && subordinateIds.includes(cust.createdById)) return true;
    // customers assigned to subordinate employees
    const assigned = await prisma.customerAssignment.findFirst({ where: { customerId: customerId, employeeId: { in: subordinateIds } } });
    if (assigned) return true;
    return false;
  }
  if (requester.role === 'employee') {
    if (requester.id === customerId) return true;
    const assigned = await prisma.customerAssignment.findFirst({ where: { customerId, employeeId: requester.id } });
    return !!assigned;
  }
  // customer
  return requester.id === customerId;
}

/**
 * Determine whether a requester can view an order
 */
export async function canViewOrder(requester, orderId) {
  if (!requester) return false;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;
  if (requester.role === 'admin') {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || '';
    if (requester.email && requester.email.toLowerCase() === (SUPERADMIN_EMAIL || '').toLowerCase()) return true;
    if (order.createdById === requester.id) return true;
    const subs = await prisma.user.findMany({ where: { createdById: requester.id }, select: { id: true } });
    const subordinateIds = subs.map(s => s.id);
    if (order.createdById && subordinateIds.includes(order.createdById)) return true;
    // customers assigned to subordinates
    const assigned = await prisma.customerAssignment.findFirst({ where: { customerId: order.customerId, employeeId: { in: subordinateIds } } });
    if (assigned) return true;
    return false;
  }
  if (requester.role === 'employee') {
    if (order.assignedToId === requester.id) return true;
    const assigned = await prisma.customerAssignment.findFirst({ where: { customerId: order.customerId, employeeId: requester.id } });
    return !!assigned;
  }
  // customer
  return order.customerId === requester.id;
}

export default { canViewCustomer, canViewOrder };
