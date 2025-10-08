// CI-ready smoke test for gestionale-clean backend
// Usage:
//   node tools/smoke-test.js
// or set env vars:
//   API_URL=http://localhost:4000/api TOKEN=<jwt> node tools/smoke-test.js

// Use global fetch on Node >=18, otherwise fall back to node-fetch if installed
let fetchFn;
if (typeof fetch === 'function') {
  fetchFn = fetch.bind(globalThis);
} else {
  try {
    fetchFn = require('node-fetch');
  } catch (e) {
    console.error('No global fetch available and node-fetch is not installed. Please use Node >=18 or install node-fetch.');
    process.exit(1);
  }
}

const fs = require('fs');
const path = require('path');
const outFile = path.resolve(__dirname, 'smoke-output.json');
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const TOKEN = process.env.TOKEN || '';

const headers = (extra = {}) => ({
  'Accept': 'application/json',
  ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
  ...extra
});

async function doGet(path) {
  const url = `${API_URL}${path}`;
  try {
    const res = await fetchFn(url, { method: 'GET', headers: headers() });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch(e) { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: String(e) };
  }
}

async function doPost(path, payload) {
  const url = `${API_URL}${path}`;
  try {
    const res = await fetchFn(url, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch(e) { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: String(e) };
  }
}

(async () => {
  console.log(`Running smoke tests against ${API_URL}`);

  const report = { api: API_URL, startedAt: new Date().toISOString(), checks: [] };

  console.log('\n1) GET /health (if present)');
  const health = await doGet('/health');
  console.log(' -', health.status, health.ok, JSON.stringify(health.body).slice(0,200));
  report.checks.push({ name: 'GET /health', status: health.status, ok: health.ok, body: health.body });

  console.log('\n2) GET /products');
  const products = await doGet('/products');
  console.log(' -', products.status, products.ok, Array.isArray(products.body) ? `items:${products.body.length}` : String(products.body).slice(0,200));
  report.checks.push({ name: 'GET /products', status: products.status, ok: products.ok, body: Array.isArray(products.body) ? { count: products.body.length } : products.body });

  // choose a productId for order testing
  let productId = null;
  if (products.ok && Array.isArray(products.body) && products.body.length > 0) {
    const first = products.body[0];
    productId = first.id || first.productId || null;
  }

  if (!productId) console.warn('No productId available; order creation test will be skipped/fail.');

  console.log('\n3) GET /users (requires auth)');
  const users = await doGet('/users');
  console.log(' -', users.status, users.ok, JSON.stringify(users.body).slice(0,200));
  report.checks.push({ name: 'GET /users', status: users.status, ok: users.ok, body: users.body });

  console.log('\n4) Create customer (POST /users) - safe test: will only run if TOKEN provided');
  let createdCustomer = null;
  if (TOKEN) {
    const dummy = { name: 'Smoke Test User', email: `smoke+${Date.now()}@example.test`, password: 'password123', role: 'customer' };
    const create = await doPost('/users', dummy);
    console.log(' -', create.status, create.ok, JSON.stringify(create.body).slice(0,200));
    report.checks.push({ name: 'POST /users', status: create.status, ok: create.ok, body: create.body });
    if (create.ok && create.body && create.body.id) createdCustomer = create.body;
  } else {
    console.log(' - SKIPPED (no TOKEN)');
    report.checks.push({ name: 'POST /users', status: 0, ok: false, body: 'SKIPPED (no TOKEN)' });
  }

  console.log('\n5) Create order (POST /orders) - smoke flow for customers (requires TOKEN)');
  if (TOKEN) {
    if (!productId && createdCustomer && createdCustomer.id) {
      console.warn('No productId available, cannot create order.');
      report.checks.push({ name: 'POST /orders', status: 0, ok: false, body: 'NO_PRODUCT' });
    } else if (!productId && (!createdCustomer || !createdCustomer.id)) {
      console.warn('No productId AND no created customer; skipping order create');
      report.checks.push({ name: 'POST /orders', status: 0, ok: false, body: 'SKIPPED' });
    } else {
      const payload = { items: [ { productId: productId, quantity: 1 } ] };
      if (createdCustomer && createdCustomer.id) payload.customerId = createdCustomer.id;
      const createOrder = await doPost('/orders', payload);
      console.log(' -', createOrder.status, createOrder.ok, JSON.stringify(createOrder.body).slice(0,300));
      report.checks.push({ name: 'POST /orders', status: createOrder.status, ok: createOrder.ok, body: createOrder.body });
    }
  } else {
    console.log(' - SKIPPED (no TOKEN)');
    report.checks.push({ name: 'POST /orders', status: 0, ok: false, body: 'SKIPPED (no TOKEN)' });
  }

  report.endedAt = new Date().toISOString();
  try { fs.writeFileSync(outFile, JSON.stringify(report, null, 2)); console.log('Wrote report to', outFile); } catch (e) { console.error('Failed to write smoke-output.json', e); }

  // Failure detection: if any critical check (products/users) failed, exit non-zero
  const criticalFailed = report.checks.some(c => (c.name === 'GET /products' || c.name === 'GET /users') && !c.ok);
  if (criticalFailed) {
    console.error('Critical checks failed, exiting with code 2');
    process.exit(2);
  }

  // If POST /orders returned not-ok, exit 3 to indicate functional failure
  const orderCheck = report.checks.find(c => c.name === 'POST /orders');
  if (orderCheck && !orderCheck.ok) {
    console.error('Order creation failed or skipped, exiting with code 3');
    process.exit(3);
  }

  console.log('\nSmoke tests finished');
  process.exit(0);
})();
