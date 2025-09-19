import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// GET: lista utenti (solo admin)
router.get("/", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Errore server" });
  }
});

// POST: crea nuovo utente (solo admin)
router.post("/", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role }
    });
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: "Errore creazione utente" });
  }
});

// PUT: modifica utente (solo admin)
router.put("/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    const updateData = { name, email, role };

    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore aggiornamento utente" });
  }
});

// DELETE: elimina utente (solo admin)
router.delete("/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Utente eliminato" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione utente" });
  }
});

export default router;
