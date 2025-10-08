import jwt from "jsonwebtoken";

// Verifica che l'utente abbia un token valido
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token mancante" });

  let token = authHeader.split(" ")[1];
  // Normalize common client mistakes where Authorization: 'Bearer null' or 'Bearer undefined' is sent
  if (typeof token === 'string' && (token.trim().toLowerCase() === 'null' || token.trim().toLowerCase() === 'undefined' || token.trim() === '')) {
    token = null;
  }
  if (!token) return res.status(401).json({ error: "Token mancante" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('DEBUG auth.authenticateToken - invalid token', err && err.message);
      return res.status(403).json({ error: "Token non valido" });
    }
    console.log('DEBUG auth.authenticateToken - decoded', decoded);
    req.user = decoded; // contiene { id, role }
    next();
  });
}

// Verifica che l'utente abbia un certo ruolo
export function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Non autenticato" });
    if (req.user.role !== role) {
      console.log('DEBUG auth.authorizeRole - role mismatch, required:', role, 'actual:', req.user.role, 'user:', req.user && req.user.id);
      return res.status(403).json({ error: "Accesso negato" });
    }
    next();
  };
}
