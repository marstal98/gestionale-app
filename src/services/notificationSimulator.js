/**
 * Sistema di simulazione notifiche per testing senza development build
 * Questo file simula il comportamento delle notifiche push per poter testare
 * la logica anche in Expo Go dove le notifiche non sono supportate
 */

import { Platform } from 'react-native';

class NotificationSimulator {
    constructor() {
        this.isSimulating = true;
        this.listeners = [];
        this.token = 'SIMULATED_TOKEN_' + Math.random().toString(36).substr(2, 9);
        
        console.log('🔄 NotificationSimulator inizializzato per testing');
        console.log('📱 Token simulato:', this.token);
    }

    // Simula la richiesta di permessi
    async requestPermissionsAsync() {
        console.log('🔐 Simulando richiesta permessi notifiche...');
        return {
            status: 'granted',
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowDisplayInCarPlay: true,
                allowCriticalAlerts: true,
                provideAppNotificationSettings: true,
                allowProvisional: true,
                allowAnnouncements: true
            },
            android: {
                importance: 4,
                interruptionFilter: 1
            },
            canAskAgain: true,
            granted: true
        };
    }

    // Simula getPermissionsAsync
    async getPermissionsAsync() {
        console.log('🔍 Simulando controllo permessi...');
        return {
            status: 'granted',
            granted: true,
            canAskAgain: true,
            ios: {
                status: 4,
                allowsAlert: true,
                allowsBadge: true,
                allowsSound: true,
                allowsDisplayInNotificationCenter: true,
                allowsDisplayOnLockScreen: true,
                allowsDisplayInCarPlay: true,
                allowsCriticalAlerts: false,
                providesAppNotificationSettings: true,
                allowProvisional: true,
                allowAnnouncements: true
            },
            android: {
                importance: 4,
                interruptionFilter: 1
            }
        };
    }

    // Simula l'ottenimento del token
    async getExpoPushTokenAsync() {
        console.log('🎫 Simulando ottenimento token push...');
        return {
            data: this.token,
            type: 'expo'
        };
    }

    // Simula l'invio di una notifica locale
    async scheduleNotificationAsync(content, trigger = null) {
        console.log('📤 Simulando invio notifica locale:', content);
        
        // Simula la ricezione dopo un breve delay
        setTimeout(() => {
            this.simulateIncomingNotification({
                identifier: 'sim_' + Date.now(),
                content: content,
                trigger: trigger,
                date: Date.now()
            });
        }, trigger?.seconds ? trigger.seconds * 1000 : 2000);

        return 'simulated_notification_id_' + Date.now();
    }

    // Simula una notifica in arrivo
    simulateIncomingNotification(notification) {
        console.log('📨 Simulando notifica ricevuta:', notification);
        
        // Notifica tutti i listener
        this.listeners.forEach(listener => {
            if (listener.type === 'received') {
                listener.callback(notification);
            }
        });
    }

    // Simula l'aggiunta di listener
    addNotificationReceivedListener(callback) {
        console.log('👂 Aggiungendo listener per notifiche ricevute');
        const listener = {
            type: 'received',
            callback: callback
        };
        this.listeners.push(listener);
        
        return {
            remove: () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    }

    // Simula l'aggiunta di listener per tap
    addNotificationResponseReceivedListener(callback) {
        console.log('👆 Aggiungendo listener per tap su notifiche');
        const listener = {
            type: 'response',
            callback: callback
        };
        this.listeners.push(listener);
        
        return {
            remove: () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    }

    // Metodi di test per simulare eventi
    simulateNotificationTap(notification) {
        console.log('👆 Simulando tap su notifica:', notification);
        this.listeners.forEach(listener => {
            if (listener.type === 'response') {
                listener.callback({
                    notification: notification,
                    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT'
                });
            }
        });
    }

    // Simula diversi tipi di notifica per testing
    async simulateNewRegistrationRequest(userData) {
        const notification = {
            title: '👤 Nuova Richiesta di Registrazione',
            body: `${userData.name} vuole registrarsi come ${userData.role}`,
            data: {
                type: 'new_registration_request',
                userId: userData.id,
                userName: userData.name,
                userEmail: userData.email,
                requestedRole: userData.role,
                timestamp: Date.now()
            }
        };

        await this.scheduleNotificationAsync(notification, { seconds: 1 });
        return notification;
    }

    async simulateOrderUpdate(orderData) {
        const notification = {
            title: '📦 Aggiornamento Ordine',
            body: `Ordine #${orderData.id} è ora: ${orderData.status}`,
            data: {
                type: 'order_update',
                orderId: orderData.id,
                status: orderData.status,
                timestamp: Date.now()
            }
        };

        await this.scheduleNotificationAsync(notification, { seconds: 1 });
        return notification;
    }

    async simulateInventoryAlert(productData) {
        const notification = {
            title: '⚠️ Scorte in Esaurimento',
            body: `${productData.name}: solo ${productData.stock} rimasti`,
            data: {
                type: 'inventory_alert',
                productId: productData.id,
                productName: productData.name,
                currentStock: productData.stock,
                timestamp: Date.now()
            }
        };

        await this.scheduleNotificationAsync(notification, { seconds: 1 });
        return notification;
    }

    // Metodo per rimuovere listener (compatibilità)
    removeNotificationSubscription(listener) {
        console.log('🗑️ Rimuovendo listener simulato');
        // In realtà non facciamo nulla, è solo per compatibilità
        return true;
    }
}

// Esporta un'istanza singleton
const notificationSimulator = new NotificationSimulator();

export default notificationSimulator;