import fetch from 'node-fetch';

const API = 'http://localhost:4000/api';
const admin = { email: 'admin@test.com', password: 'password123' };

async function login() {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(admin) });
  const body = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(body));
  return body;
}

async function main() {
  try {
    const { token } = await login();
    console.log('Logged in, token length', token.length);

    // get products
    const pRes = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
    const products = await pRes.json();
    console.log('Products before:', products.map(p => ({ id: p.id, stock: p.stock })));

    // create draft order with first product qty 1
    const first = products[0];
    const createRes = await fetch(`${API}/orders`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: [{ productId: first.id, quantity: 1 }], status: 'draft' }) });
    const createBody = await createRes.json();
    console.log('Create draft status', createRes.status, createBody);

    // check product stock after draft
    const pRes2 = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
    const productsAfterDraft = await pRes2.json();
    console.log('Products after draft:', productsAfterDraft.map(p => ({ id: p.id, stock: p.stock })));

    // now send order to pending
    const orderId = createBody.id;
    const sendRes = await fetch(`${API}/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'pending' }) });
    const sendBody = await sendRes.json();
    console.log('Send to pending status', sendRes.status, sendBody);

    // check product stock after sending
    const pRes3 = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
    const productsAfterSend = await pRes3.json();
    console.log('Products after send:', productsAfterSend.map(p => ({ id: p.id, stock: p.stock })));

  } catch (e) {
    console.error('E2E Draft test error', e);
  }
}

main();
