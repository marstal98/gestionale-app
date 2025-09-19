import jwt from "jsonwebtoken";

// Verifica che l'utente abbia un token valido
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token mancante" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token mancante" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Token non valido" });
    req.user = decoded; // contiene { id, role }
    next();
  });
}

// Verifica che l'utente abbia un certo ruolo
export function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Non autenticato" });
    if (req.user.role !== role)
      return res.status(403).json({ error: "Accesso negato" });
    next();
  };
}
