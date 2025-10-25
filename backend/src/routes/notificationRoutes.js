/**
 * Notification Routes per il backend
 * 
 * Gestisce:
 * - Registrazione token dispositivi
 * - Invio notifiche push tramite Expo
 * - Gestione gruppi utenti per notifiche
 */

import express from 'express';
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const expo = new Expo();

/**
 * Registra token push di un dispositivo
 */
router.post('/register-token', async (req, res) => {
    console.log('🔄 [BACKEND] Richiesta registrazione token ricevuta:', {
        body: req.body,
        headers: req.headers.authorization ? 'HAS_AUTH' : 'NO_AUTH'
    });
    
    try {
        const { token, platform, deviceId, userId, userRole } = req.body;
        
        // Per token simulati, accetta userId dal body
        // Per token reali, usa autenticazione
        let actualUserId = userId;
        if (!token || !token.startsWith('SIMULATED_TOKEN_')) {
            // Token reale: richiede autenticazione
            const authResult = authenticateToken(req, res, () => {});
            if (!req.user) {
                return res.status(401).json({ error: 'Autenticazione richiesta per token reali' });
            }
            actualUserId = req.user.id;
        }

        // Accetta token simulati per testing (iniziano con SIMULATED_TOKEN_)
        const isSimulatedToken = token && token.startsWith('SIMULATED_TOKEN_');
        const isValidExpoToken = Expo.isExpoPushToken(token);
        
        console.log('🔍 [BACKEND] Validazione token:', {
            token,
            isSimulatedToken,
            isValidExpoToken,
            actualUserId
        });
        
        if (!token || (!isValidExpoToken && !isSimulatedToken)) {
            return res.status(400).json({ 
                error: 'Token push non valido',
                details: { token, isValidExpoToken, isSimulatedToken }
            });
        }

        // Salva/aggiorna token nel database
        const pushToken = await prisma.pushToken.upsert({
            where: {
                token: token
            },
            update: {
                userId: actualUserId,
                platform: platform || 'unknown',
                deviceId: deviceId || null,
                lastUsed: new Date(),
                isActive: true
            },
            create: {
                token: token,
                userId: actualUserId,
                platform: platform || 'unknown',
                deviceId: deviceId || null,
                lastUsed: new Date(),
                isActive: true
            }
        });

        console.log(`✅ Token registrato per utente ${userId}:`, token.substring(0, 20) + '...');
        
        res.json({ 
            success: true, 
            message: 'Token registrato con successo',
            tokenId: pushToken.id
        });

    } catch (error) {
        console.error('❌ Errore registrazione token:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

/**
 * Rimuove token push
 */
router.post('/unregister-token', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ 
                error: 'Token richiesto' 
            });
        }

        await prisma.pushToken.updateMany({
            where: { token: token },
            data: { isActive: false }
        });

        console.log('✅ Token disattivato:', token.substring(0, 20) + '...');
        
        res.json({ 
            success: true, 
            message: 'Token rimosso con successo' 
        });

    } catch (error) {
        console.error('❌ Errore rimozione token:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

/**
 * Invia notifica a utenti specifici per ruolo
 */
router.post('/send-to-role', authenticateToken, async (req, res) => {
    try {
        const { role, title, body, data = {} } = req.body;

        if (!role || !title || !body) {
            return res.status(400).json({ 
                error: 'Ruolo, titolo e corpo sono richiesti' 
            });
        }

        // Trova tutti i token degli utenti con il ruolo specificato
        const tokens = await prisma.pushToken.findMany({
            where: {
                isActive: true,
                user: {
                    role: role
                }
            },
            include: {
                user: {
                    select: { id: true, email: true, role: true }
                }
            }
        });

        if (tokens.length === 0) {
            return res.json({ 
                success: true, 
                message: `Nessun utente attivo con ruolo ${role}`,
                sent: 0
            });
        }

        // Prepara messaggi per Expo (inclusi i token simulati per testing)
        const messages = tokens
            .filter(tokenRecord => {
                const isValidExpo = Expo.isExpoPushToken(tokenRecord.token);
                const isSimulated = tokenRecord.token && tokenRecord.token.startsWith('SIMULATED_TOKEN_');
                return isValidExpo || isSimulated;
            })
            .map(tokenRecord => ({
                to: tokenRecord.token,
                sound: 'default',
                title: title,
                body: body,
                data: {
                    ...data,
                    timestamp: new Date().toISOString(),
                    targetUserId: tokenRecord.user.id
                }
            }));

        if (messages.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Nessun token valido trovato',
                sent: 0
            });
        }

        // Separa messaggi reali da quelli simulati
        const realMessages = messages.filter(msg => Expo.isExpoPushToken(msg.to));
        const simulatedMessages = messages.filter(msg => msg.to && msg.to.startsWith('SIMULATED_TOKEN_'));
        
        const tickets = [];

        // Invia notifiche reali in batch
        if (realMessages.length > 0) {
            const chunks = expo.chunkPushNotifications(realMessages);
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    tickets.push(...ticketChunk);
                } catch (error) {
                    console.error('❌ Errore invio chunk:', error);
                }
            }
        }

        // Simula l'invio per i token di test
        if (simulatedMessages.length > 0) {
            console.log('🧪 Simulando invio di', simulatedMessages.length, 'notifiche di test:', {
                title, body, data
            });
            // Crea ticket simulati di successo
            simulatedMessages.forEach(msg => {
                tickets.push({
                    id: `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'ok'
                });
            });
        }

        // Log risultati
        const successful = tickets.filter(ticket => ticket.status === 'ok').length;
        const errors = tickets.filter(ticket => ticket.status === 'error').length;

        console.log(`📤 Notifiche inviate: ${successful} successi, ${errors} errori`);

        res.json({
            success: true,
            message: `Notifiche inviate a ${successful} dispositivi`,
            sent: successful,
            errors: errors,
            details: {
                targetRole: role,
                totalTokens: tokens.length,
                validTokens: messages.length,
                tickets: tickets.length
            }
        });

    } catch (error) {
        console.error('❌ Errore invio notifiche:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

/**
 * Invia notifica a utente specifico
 */
router.post('/send-to-user', authenticateToken, async (req, res) => {
    try {
        const { userId, title, body, data = {} } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({ 
                error: 'UserId, titolo e corpo sono richiesti' 
            });
        }

        // Trova token dell'utente
        const tokens = await prisma.pushToken.findMany({
            where: {
                userId: userId,
                isActive: true
            }
        });

        if (tokens.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Utente non ha dispositivi attivi',
                sent: 0
            });
        }

        // Invia a tutti i dispositivi dell'utente (inclusi quelli simulati)
        const messages = tokens
            .filter(tokenRecord => {
                const isValidExpo = Expo.isExpoPushToken(tokenRecord.token);
                const isSimulated = tokenRecord.token && tokenRecord.token.startsWith('SIMULATED_TOKEN_');
                return isValidExpo || isSimulated;
            })
            .map(tokenRecord => ({
                to: tokenRecord.token,
                sound: 'default',
                title: title,
                body: body,
                data: {
                    ...data,
                    timestamp: new Date().toISOString(),
                    targetUserId: userId
                }
            }));

        if (messages.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Nessun token valido per utente',
                sent: 0
            });
        }

        // Separa messaggi reali da quelli simulati
        const realMessages = messages.filter(msg => Expo.isExpoPushToken(msg.to));
        const simulatedMessages = messages.filter(msg => msg.to && msg.to.startsWith('SIMULATED_TOKEN_'));
        
        let ticketChunk = [];
        
        // Invia notifiche reali
        if (realMessages.length > 0) {
            ticketChunk = await expo.sendPushNotificationsAsync(realMessages);
        }
        
        // Simula l'invio per i token di test
        if (simulatedMessages.length > 0) {
            console.log('🧪 Simulando invio notifica utente:', { title, body, userId });
            simulatedMessages.forEach(() => {
                ticketChunk.push({
                    id: `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'ok'
                });
            });
        }
        
        const successful = ticketChunk.filter(ticket => ticket.status === 'ok').length;

        console.log(`📤 Notifica inviata a utente ${userId}: ${successful} dispositivi`);

        res.json({
            success: true,
            message: `Notifica inviata a ${successful} dispositivi`,
            sent: successful
        });

    } catch (error) {
        console.error('❌ Errore invio notifica utente:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

/**
 * Funzione helper per inviare notifica nuova registrazione ai SuperAdmin
 */
const notifyNewRegistrationRequest = async (registrationData) => {
    try {
        // Trova tutti i SuperAdmin con token attivi
        const tokens = await prisma.pushToken.findMany({
            where: {
                isActive: true,
                user: {
                    role: 'superadmin'
                }
            }
        });

        if (tokens.length === 0) {
            console.log('⚠️ Nessun SuperAdmin con notifiche attive');
            return;
        }

        const messages = tokens
            .filter(tokenRecord => {
                const isValidExpo = Expo.isExpoPushToken(tokenRecord.token);
                const isSimulated = tokenRecord.token && tokenRecord.token.startsWith('SIMULATED_TOKEN_');
                return isValidExpo || isSimulated;
            })
            .map(tokenRecord => ({
                to: tokenRecord.token,
                sound: 'default',
                title: '🔔 Nuova Richiesta Registrazione',
                body: `${registrationData.username} vuole registrarsi come ${registrationData.role}`,
                data: {
                    type: 'new_registration_request',
                    screen: 'UsersScreen',
                    requestId: registrationData.id,
                    timestamp: new Date().toISOString()
                }
            }));

        if (messages.length > 0) {
            // Separa messaggi reali da quelli simulati
            const realMessages = messages.filter(msg => Expo.isExpoPushToken(msg.to));
            const simulatedMessages = messages.filter(msg => msg.to && msg.to.startsWith('SIMULATED_TOKEN_'));
            
            let ticketChunk = [];
            
            // Invia notifiche reali
            if (realMessages.length > 0) {
                ticketChunk = await expo.sendPushNotificationsAsync(realMessages);
            }
            
            // Simula l'invio per i token di test
            if (simulatedMessages.length > 0) {
                console.log('🧪 Simulando notifica registrazione per', simulatedMessages.length, 'SuperAdmin di test');
                simulatedMessages.forEach(() => {
                    ticketChunk.push({
                        id: `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        status: 'ok'
                    });
                });
            }
            
            const successful = ticketChunk.filter(ticket => ticket.status === 'ok').length;
            console.log(`📤 Notifica registrazione inviata a ${successful} SuperAdmin`);
        }

    } catch (error) {
        console.error('❌ Errore notifica registrazione:', error);
    }
};

/**
 * Ottieni statistiche notifiche
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await prisma.pushToken.groupBy({
            by: ['platform'],
            where: { isActive: true },
            _count: { id: true }
        });

        const totalActiveTokens = await prisma.pushToken.count({
            where: { isActive: true }
        });

        const userStats = await prisma.pushToken.groupBy({
            by: ['userId'],
            where: { isActive: true },
            _count: { id: true }
        });

        res.json({
            totalActiveTokens,
            uniqueUsers: userStats.length,
            platformBreakdown: stats.reduce((acc, stat) => {
                acc[stat.platform] = stat._count.id;
                return acc;
            }, {}),
            averageTokensPerUser: userStats.length > 0 ? 
                (totalActiveTokens / userStats.length).toFixed(2) : 0
        });

    } catch (error) {
        console.error('❌ Errore statistiche:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

// Esporta sia il router che le funzioni helper
export { router, notifyNewRegistrationRequest };