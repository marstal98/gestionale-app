import fetch from 'node-fetch';
const BASE = 'http://localhost:4000';

function buildHeaders(token, extra = {}) {
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function run(){
  console.log('LOGIN admin');
  let res = await fetch(`${BASE}/api/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@test.com', password:'password123'})});
  const loginBody = await res.json();
  const token = loginBody.token;
  console.log('token length', token?.length);

  const pRes = await fetch(`${BASE}/api/products`, { headers: buildHeaders(token) });
  const products = await pRes.json();
  console.log('products', products.map(p=>({id:p.id, stock:p.stock})).slice(0,3));

  const uRes = await fetch(`${BASE}/api/users`, { headers: buildHeaders(token) });
  const users = await uRes.json();
  console.log('users', users.map(u=>({id:u.id, email:u.email, role:u.role})).slice(0,10));

  const assignee = users.find(u=>u.role === 'employee') || users[0];
  const product = products[0];
  console.log('creating order assigned to', assignee.id);
  res = await fetch(`${BASE}/api/orders`, {method:'POST', headers:buildHeaders(token, {'Content-Type':'application/json'}), body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }], assignedToId: assignee.id })});
  console.log('create status', res.status);
  const created = await res.json();
  console.log('created', created);

  // try reassign to a different user
  const newAssignee = users.find(u=>u.id !== assignee.id) || assignee;
  console.log('reassign to', newAssignee.id);
  res = await fetch(`${BASE}/api/orders/${created.id}/assign`, {method:'PUT', headers:buildHeaders(token, {'Content-Type':'application/json'}), body: JSON.stringify({ assignedToId: newAssignee.id })});
  console.log('reassign status', res.status);
  console.log('reassign body', await res.json());
}

run().catch(e=>{ console.error('E2E error', e); process.exit(1) });
