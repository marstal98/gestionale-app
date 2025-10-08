import fetch from 'node-fetch';
(async ()=>{
  try{
    const API='http://localhost:4000/api';
    const login = await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@test.com',password:'password123'})});
    console.log('login status', login.status);
    const jb = await login.text();
    console.log(jb);
    if(!login.ok) return;
    const token = JSON.parse(jb).token;
    const id = 16;
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  const g = await fetch(API+`/orders/${id}`,{headers});
    console.log('GET status', g.status);
    console.log(await g.text());
  const del = await fetch(API+`/orders/${id}`,{method:'DELETE',headers});
    console.log('DELETE status', del.status);
    console.log(await del.text());
  }catch(e){console.error(e);} 
})();
