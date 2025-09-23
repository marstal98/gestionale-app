import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
// Global request logger (debug)
app.use((req, res, next) => {
  if (process.env.DEBUG_ORDERS === 'true') console.log('[req]', req.method, req.originalUrl);
  next();
});

// RAW logger for orders routes - prints headers and body chunks to inspect incoming requests
app.use((req, res, next) => {
	try {
		if (process.env.DEBUG_ORDERS === 'true' && String(req.url || '').startsWith('/api/orders')) {
			console.log('[RAW-ORDERS]', req.method, req.url, 'HEADERS:', JSON.stringify(req.headers));
			const chunks = [];
			req.on('data', (c) => { chunks.push(c); });
			req.on('end', () => {
				try {
					if (chunks.length) {
						const b = Buffer.concat(chunks).toString('utf8');
						console.log('[RAW-ORDERS] body:', b);
						req.rawBody = b;
					}
				} catch (e) { if (process.env.DEBUG_ORDERS === 'true') console.error('raw logger body parse error', e); }
			});
		}
	} catch (e) { if (process.env.DEBUG_ORDERS === 'true') console.error('raw logger error', e); }
	next();
});

app.use(express.json());

// Debug endpoint to inspect method
app.all('/debug-method', (req, res) => {
	res.json({ method: req.method, url: req.originalUrl });
});

// Rotte
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
// Debug: log incoming requests to orders to help troubleshoot 404s
// Debug catch-all for /api/orders: log request details then continue to router
app.use('/api/orders', (req, res, next) => {
	try {
		if (process.env.DEBUG_ORDERS === 'true') {
			console.log('[ORDERS-CATCH] ', req.method, req.originalUrl, 'headers:', JSON.stringify(req.headers));
			if (req.rawBody) console.log('[ORDERS-CATCH] rawBody:', req.rawBody);
		}
	} catch (e) { if (process.env.DEBUG_ORDERS === 'true') console.error('orders catch log error', e); }
	next();
});
app.use("/api/orders", orderRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/inventory", inventoryRoutes);

// Fallback handlers: expose assign/status/cancel at app-level in case router methods not matched
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from './middleware/auth.js';
const _prisma = new PrismaClient();

app.post('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
	const { id } = req.params; const user = req.user;
	try {
		const order = await _prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: true } });
		if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
		if (user.role !== 'admin' && user.id !== order.createdById && user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
		if (order.status === 'cancelled') return res.status(400).json({ error: 'Ordine già cancellato' });
		if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile cancellarlo." });
		await _prisma.$transaction(async (tx) => {
			for (const it of order.items) {
				await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
				await tx.inventoryMovement.create({ data: { productId: it.productId, type: 'release', quantity: it.quantity, metadata: { orderId: order.id } } });
			}
			await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
		});
		res.json({ cancelled: true });
	} catch (err) { console.error('Fallback cancel error', err); res.status(500).json({ error: 'Errore cancellazione ordine' }); }
});

app.put('/api/orders/:id/assign', authenticateToken, async (req, res) => {
	const { id } = req.params; const { assignedToId } = req.body; const user = req.user;
	try {
		const orderId = parseInt(id); if (Number.isNaN(orderId)) return res.status(400).json({ error: 'Order id non valido' });
		const order = await _prisma.order.findUnique({ where: { id: orderId } }); if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
		if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile modificarlo." });
		if (user.role !== 'admin') return res.status(403).json({ error: 'Solo admin può riassegnare ordini' });
		if (assignedToId) {
			const assignee = await _prisma.user.findUnique({ where: { id: parseInt(assignedToId) } }); if (!assignee) return res.status(400).json({ error: 'Utente assegnato non trovato' });
			if (!['employee','admin'].includes(String(assignee.role))) return res.status(400).json({ error: 'Assegnatario deve essere un dipendente (employee) o admin' });
		}
		const newData = { assignedToId: assignedToId ? parseInt(assignedToId) : null };
		if (assignedToId) newData.status = 'in_progress'; else if (order.status !== 'completed' && order.status !== 'cancelled') newData.status = 'pending';
		const updated = await _prisma.order.update({ where: { id: order.id }, data: newData });
		res.json({ ok: true, assignedToId: updated.assignedToId || null });
	} catch (err) { console.error('Fallback assign error', err); res.status(500).json({ error: 'Errore assegnazione ordine' }); }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
	const { id } = req.params; const { status } = req.body; const user = req.user;
	const allowedStatuses = ['draft','pending','in_progress','completed','cancelled'];
	if (!status || !allowedStatuses.includes(status)) return res.status(400).json({ error: 'Stato non valido' });
	try {
		const order = await _prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: true } }); if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
		if (order.status === 'completed') return res.status(400).json({ error: "Ordine completato. Non è possibile modificare lo stato." });
		if (user.role === 'customer') {
			if (user.id !== order.customerId) return res.status(403).json({ error: 'Accesso negato' });
			if (status === 'pending' && order.status !== 'draft') return res.status(400).json({ error: 'Transizione non permessa' });
			if (status === 'cancelled' && (order.status === 'cancelled' || order.status === 'completed')) return res.status(400).json({ error: 'Ordine già in stato finale' });
		}
		if (user.role === 'employee') {
			if (status === 'in_progress') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per prenderlo in carico' }); if (order.status !== 'pending') return res.status(400).json({ error: 'Transizione non permessa' }); }
			else if (status === 'completed') { if (order.assignedToId !== user.id) return res.status(403).json({ error: 'Devi essere assegnato a questo ordine per completarlo' }); if (order.status !== 'in_progress') return res.status(400).json({ error: 'Transizione non permessa' }); }
			else return res.status(403).json({ error: 'Permessi insufficienti' });
		}
		const updated = await _prisma.order.update({ where: { id: order.id }, data: { status } });
		res.json({ ok: true, status: updated.status });
	} catch (err) { console.error('Fallback change status error', err); res.status(500).json({ error: 'Errore cambio stato ordine' }); }
});

// 404 handler - always return JSON for unknown routes
app.use((req, res, next) => {
	res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Generic error handler - always return JSON
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	const status = err.status || 500;
	const message = err.message || 'Internal Server Error';
	res.status(status).json({ error: message, details: process.env.NODE_ENV === 'development' ? (err.stack || null) : undefined });
});

// Avvio server
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
	const bindHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
	console.log(`✅ Server avviato su http://${bindHost}:${PORT} (listening on ${HOST})`);
});
