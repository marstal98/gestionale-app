const BASE = 'http://localhost:4000';

async function run(){
  console.log('\n1) LOGIN admin');
  let res = await fetch(`${BASE}/api/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@test.com', password:'password123'})});
  console.log('login status', res.status);
  const loginBody = await res.json();
  console.log('login body', loginBody);
  const token = loginBody.token;

  console.log('\n2) GET /api/products (authenticated)');
  res = await fetch(`${BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('products status', res.status);
  let products = await res.json();
  console.log('products', products);

  console.log('\n3) POST invalid order (qty > stock)');
  res = await fetch(`${BASE}/api/orders`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ items: [{ productId: products[0].id, quantity: products[0].stock + 100 }] })});
  console.log('invalid order status', res.status);
  console.log('invalid order body', await res.text());

  console.log('\n4) GET /api/products (after invalid order)');
  res = await fetch(`${BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('products status', res.status);
  products = await res.json();
  console.log('products after invalid attempt', products);

  console.log('\n5) POST valid order (qty 1)');
  res = await fetch(`${BASE}/api/orders`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ items: [{ productId: products[0].id, quantity: 1 }] })});
  console.log('valid order status', res.status);
  console.log('valid order body', await res.text());

  console.log('\n6) GET /api/products (after valid order)');
  res = await fetch(`${BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('products status', res.status);
  products = await res.json();
  console.log('products after valid order', products);
}

run().catch(e=>{ console.error('E2E error', e); process.exit(1) });
