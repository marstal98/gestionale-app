// CommonJS wrapper that loads @prisma/client from backend/node_modules
const path = require('path');
const backendNodeModules = path.resolve(__dirname, '..', 'backend', 'node_modules');
const Module = require('module');
const originalPaths = Module._nodeModulePaths(process.cwd());
// Inject backend/node_modules into module resolution
Module._nodeModulePaths = function(from) { return [backendNodeModules, ...originalPaths]; }

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const prods = await prisma.product.findMany();
  console.log(JSON.stringify(prods, null, 2));
  await prisma.$disconnect();
})();
