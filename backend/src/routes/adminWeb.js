import express from 'express';
const router = express.Router();

// Minimal admin single-file UI to login and manage access-requests.
// This page uses the existing API endpoints: /api/auth/login, /api/access-requests, /api/access-requests/:id/handle
router.get('/', (req, res) => {
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>GestioNexus - Admin Access Requests</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;background:#f4f6f8}
      .card{background:#fff;padding:12px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
      button{margin-right:6px}
      .hidden{display:none}
      .top{display:flex;gap:12px;align-items:center;margin-bottom:12px}
      input{padding:8px;border-radius:6px;border:1px solid #ddd}
    </style>
  </head>
  <body>
    <h2>Admin - Gestione richieste di accesso</h2>
    <div id="loginBox" class="card">
      <div class="top">
        <input id="email" placeholder="Email admin" type="email" />
        <input id="password" placeholder="Password" type="password" />
        <button id="btnLogin">Login</button>
        <button id="btnLogout" class="hidden">Logout</button>
      </div>
      <div id="loginMsg"></div>
    </div>

    <div id="main" class="hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <strong>Lista richieste</strong>
        </div>
        <div>
          <button id="btnRefresh">Aggiorna</button>
        </div>
      </div>
      <div id="list"></div>
    </div>

    <script>
      const apiBase = '';
      const el = (id)=> document.getElementById(id);
      const setMsg = (m)=> el('loginMsg').innerText = m || '';

      const saveToken = (t)=> { localStorage.setItem('admin_token', t); }
      const loadToken = ()=> localStorage.getItem('admin_token');
      const clearToken = ()=> localStorage.removeItem('admin_token');

      const setLoggedIn = (v)=> {
        if (v) { el('main').classList.remove('hidden'); el('btnLogout').classList.remove('hidden'); el('btnLogin').classList.add('hidden'); }
        else { el('main').classList.add('hidden'); el('btnLogout').classList.add('hidden'); el('btnLogin').classList.remove('hidden'); }
      }

      async function login() {
        setMsg('');
        const email = el('email').value; const password = el('password').value;
        try {
          const res = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
          const b = await res.json().catch(()=>({}));
          if (!res.ok) { setMsg('Login fallito'); return; }
          if (!b.token) { setMsg('Risposta login non valida'); return; }
          saveToken(b.token);
          setLoggedIn(true);
          fetchList();
        } catch (e) { console.error(e); setMsg('Errore di rete'); }
      }

      async function fetchList() {
        const token = loadToken(); if (!token) return; el('list').innerHTML = 'Caricamento...';
      try {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api/access-requests', { headers });
        let data = await res.json().catch(()=>[]);
  if (!res.ok) { el('list').innerHTML = '<div class="card">Errore caricamento richieste</div>'; return; }
        if (!Array.isArray(data)) data = [];
        if (data.length === 0) { el('list').innerHTML = '<div class="card">Nessuna richiesta</div>'; return; }
          el('list').innerHTML = data.map(function(r){
            return '<div class="card">'
              + '<div><strong>' + (r.name || '(anonimo)') + '</strong> &lt;' + (r.email || '') + '&gt;</div>'
              + '<div>Azienda: ' + (r.company || '-') + '</div>'
              + '<div>Messaggio: ' + (r.message || '-') + '</div>'
              + '<div>Stato: ' + (r.status || '') + '</div>'
              + '<div style="margin-top:8px">'
                + '<button onclick="handleAction(' + r.id + ', \'accept\')">Accetta</button>'
                + '<button onclick="handleAction(' + r.id + ', \'reject\')">Rifiuta</button>'
              + '</div>'
            + '</div>';
          }).join('');
        } catch (e) { console.error(e); el('list').innerHTML = '<div class="card">Errore server</div>'; }
      }

      async function handleAction(id, action) {
        const token = loadToken(); if (!token) { setMsg('Non autenticato'); return; }
        try {
          const headers = { 'Content-Type':'application/json' };
          if (token) headers.Authorization = 'Bearer ' + token;
          const res = await fetch('/api/access-requests/' + id + '/handle', { method: 'POST', headers, body: JSON.stringify({ action }) });
          const b = await res.json().catch(()=>({}));
          if (!res.ok) { alert('Errore'); return; }
          alert('Richiesta ' + action + ' con successo');
          fetchList();
        } catch (e) { console.error(e); alert('Errore server'); }
      }

      el('btnLogin').addEventListener('click', login);
      el('btnLogout').addEventListener('click', ()=>{ clearToken(); setLoggedIn(false); setMsg(''); });
      el('btnRefresh').addEventListener('click', fetchList);

      // on load, if token present, show main
      if (loadToken()) { setLoggedIn(true); fetchList(); }
    </script>
  </body>
  </html>`;

  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
});

export default router;
