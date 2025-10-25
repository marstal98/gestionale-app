/**
 * NotificationService - Gestione completa delle notifiche push
 * 
 * Questo servizio gestisce:
 * - Registrazione per le notifiche push
 * - Invio di notifiche locali e remote
 * - Gestione token device per il backend
 * - Listener per notifiche ricevute
 */

// DISABILITATO COMPLETAMENTE PER EXPO GO
// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import notificationSimulator from './notificationSimulator';
import { API_URL } from '../config';

// SEMPRE SIMULATORE IN EXPO GO - NO EXPO-NOTIFICATIONS
const isExpoGo = Constants.appOwnership === 'expo';
const shouldUseSimulator = true; // FORZATO SEMPRE A TRUE PER EXPO GO

console.log('🔄 NotificationService: Modalità simulatore forzata per Expo Go');

class NotificationService {
    constructor() {
        this.expoPushToken = null;
        this.notificationListener = null;
        this.responseListener = null;
        this.isInitialized = false;
    }

    /**
     * Inizializza il servizio di notifiche
     * Richiede permessi e registra il token
     */
    async initialize() {
        try {
            // Evita inizializzazioni multiple
            if (this.isInitialized) {
                console.log('⚠️ Servizio già inizializzato, ritornando token esistente');
                return this.expoPushToken;
            }

            // Se dobbiamo usare il simulatore (Expo Go non supporta notifiche reali)
            if (shouldUseSimulator) {
                console.log('🔄 Modalità simulazione attiva - Expo Go rilevato');
                console.log('📱 Le notifiche reali richiedono un Development Build');
                
                // Simula la richiesta di permessi
                const permissions = await notificationSimulator.requestPermissionsAsync();
                if (!permissions.granted) {
                    console.warn('Permessi simulati per le notifiche non concessi');
                    return null;
                }

                // Ottieni token simulato
                const tokenData = await notificationSimulator.getExpoPushTokenAsync();
                this.expoPushToken = tokenData.data;
                
                console.log('✅ Simulatore attivo con token:', this.expoPushToken);
                
                // Configura i listener del simulatore
                this.setupSimulatorListeners();
                
                this.isInitialized = true;
                return this.expoPushToken;
            }

            // TUTTO IL RESTO RIMOSSO - SOLO SIMULATORE IN EXPO GO

        } catch (error) {
            console.error('❌ Errore inizializzazione NotificationService:', error);
            return null;
        }
    }

    // getExpoPushToken RIMOSSO - SOLO SIMULATORE

    // setupNotificationListeners RIMOSSO - SOLO SIMULATORE

    /**
     * Configura i listener per il simulatore di notifiche
     */
    setupSimulatorListeners() {
        // Listener per notifiche simulate ricevute
        this.notificationListener = notificationSimulator.addNotificationReceivedListener(notification => {
            console.log('📱 Notifica simulata ricevuta:', notification);
            this.handleNotificationReceived(notification);
        });

        // Listener per quando l'utente tocca una notifica simulata
        this.responseListener = notificationSimulator.addNotificationResponseReceivedListener(response => {
            console.log('👆 Notifica simulata toccata:', response);
            this.handleNotificationResponse(response);
        });
    }

    /**
     * Gestisce una notifica ricevuta
     */
    handleNotificationReceived(notification) {
        const data = notification?.request?.content?.data;
        
        if (!data) {
            console.log('Notifica ricevuta senza dati validi:', notification);
            return;
        }
        
        // Logica specifica per tipo di notifica
        switch (data?.type) {
            case 'new_registration_request':
                this.handleNewRegistrationRequest(data);
                break;
            case 'order_status_update':
                this.handleOrderStatusUpdate(data);
                break;
            case 'low_inventory':
                this.handleLowInventory(data);
                break;
            default:
                console.log('Notifica generica ricevuta');
        }
    }

    /**
     * Gestisce il tap su una notifica (navigazione)
     */
    handleNotificationResponse(response) {
        const data = response?.notification?.request?.content?.data;
        
        if (!data) {
            console.log('Risposta notifica senza dati validi:', response);
            return;
        }
        
        // Qui puoi implementare la navigazione basata sul tipo di notifica
        if (data?.screen) {
            // Naviga allo screen specifico
            console.log(`Navigating to: ${data.screen}`);
            // this.navigation.navigate(data.screen, data.params);
        }
    }

    /**
     * Gestisce richieste di nuova registrazione (SuperAdmin)
     */
    handleNewRegistrationRequest(data) {
        console.log('🔔 Nuova richiesta di registrazione:', data);
        
        // Potresti mostrare un modal o aggiornare un badge
        // EventEmitter.emit('new_registration_request', data);
    }

    /**
     * Gestisce aggiornamenti stato ordini
     */
    handleOrderStatusUpdate(data) {
        console.log('📦 Aggiornamento stato ordine:', data);
    }

    /**
     * Gestisce avvisi inventario basso
     */
    handleLowInventory(data) {
        console.log('⚠️ Inventario basso:', data);
    }

    /**
     * Invia una notifica locale (SIMULATA)
     */
    async sendLocalNotification(title, body, data = {}) {
        try {
            // Usa il simulatore invece di Expo Notifications
            await notificationSimulator.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: 'default',
                },
                trigger: null, // Invia immediatamente
            });
            
            console.log('✅ Notifica locale simulata inviata');
        } catch (error) {
            console.error('❌ Errore invio notifica locale simulata:', error);
        }
    }

    /**
     * Registra il token del dispositivo sul backend
     */
    async registerTokenWithBackend(userId, userRole, authToken = null) {
        if (!this.expoPushToken) {
            console.warn('Token non disponibile per registrazione');
            return false;
        }

        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Aggiungi token di autenticazione se fornito
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const requestBody = {
                token: this.expoPushToken,
                userId,
                userRole,
                platform: Platform.OS,
                deviceId: Constants.deviceId,
            };

            console.log('🔄 Registrando token:', {
                url: `${API_URL}/notifications/register-token`,
                token: this.expoPushToken,
                userId,
                userRole,
                hasAuthToken: !!authToken
            });

            const response = await fetch(`${API_URL}/notifications/register-token`, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                console.log('✅ Token registrato sul backend');
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ Errore registrazione token:', {
                    status: response.status,
                    error: errorText,
                    requestBody
                });
                return false;
            }
        } catch (error) {
            console.error('❌ Errore connessione backend per token:', error);
            return false;
        }
    }

    /**
     * Cancella la registrazione delle notifiche
     */
    async unregisterFromNotifications() {
        try {
            if (this.notificationListener) {
                // Usa il simulatore invece di Notifications
                notificationSimulator.removeNotificationSubscription(this.notificationListener);
            }
            
            if (this.responseListener) {
                // Usa il simulatore invece di Notifications
                notificationSimulator.removeNotificationSubscription(this.responseListener);
            }

            // Rimuovi token dal backend
            if (this.expoPushToken) {
                await fetch(`${API_URL}/notifications/unregister-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: this.expoPushToken }),
                });
            }

            console.log('✅ Notifiche disattivate');
        } catch (error) {
            console.error('❌ Errore disattivazione notifiche:', error);
        }
    }

    /**
     * Ottiene le impostazioni di notifica correnti (SIMULATA)
     */
    async getNotificationSettings() {
        try {
            // Usa il simulatore - fix import
            const settings = await notificationSimulator.requestPermissionsAsync();
            return {
                granted: settings.granted,
                canAskAgain: settings.canAskAgain || false,
                status: settings.granted ? 'granted' : 'denied',
            };
        } catch (error) {
            console.error('Errore ottenimento impostazioni:', error);
            return { granted: false, canAskAgain: true, status: 'undetermined' };
        }
    }

    /**
     * Metodi di utilità per tipi specifici di notifiche
     */
    
    // Notifica per SuperAdmin - Nuova richiesta registrazione
    async notifyNewRegistrationRequest(requestData) {
        if (shouldUseSimulator) {
            return await notificationSimulator.simulateNewRegistrationRequest({
                id: requestData.id,
                name: requestData.username,
                email: requestData.email,
                role: requestData.role
            });
        }
        
        return this.sendLocalNotification(
            '🔔 Nuova Richiesta Registrazione',
            `${requestData.username} vuole registrarsi come ${requestData.role}`,
            {
                type: 'new_registration_request',
                screen: 'UsersScreen',
                requestId: requestData.id,
            }
        );
    }

    // Notifica aggiornamento ordine
    async notifyOrderUpdate(orderData) {
        if (shouldUseSimulator) {
            return await notificationSimulator.simulateOrderUpdate({
                id: orderData.id,
                status: orderData.status
            });
        }
        
        return this.sendLocalNotification(
            '📦 Aggiornamento Ordine',
            `Ordine #${orderData.id} è ora ${orderData.status}`,
            {
                type: 'order_status_update',
                screen: 'OrdersScreen',
                orderId: orderData.id,
            }
        );
    }

    // Notifica inventario basso
    async notifyLowInventory(productData) {
        if (shouldUseSimulator) {
            return await notificationSimulator.simulateInventoryAlert({
                id: productData.id,
                name: productData.name,
                stock: productData.quantity
            });
        }
        
        return this.sendLocalNotification(
            '⚠️ Inventario Basso',
            `${productData.name} ha solo ${productData.quantity} unità rimaste`,
            {
                type: 'low_inventory',
                screen: 'ProductsScreen',
                productId: productData.id,
            }
        );
    }
}

// Esporta un'istanza singleton
export default new NotificationService();