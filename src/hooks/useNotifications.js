/**
 * useNotifications - Hook personalizzato per gestire le notifiche nell'app
 * 
 * Questo hook fornisce:
 * - Stato delle notifiche (permessi, token)
 * - Funzioni per inviare notifiche specifiche per business
 * - Gestione listener e cleanup automatico
 */

import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import notificationService from '../services/notificationService';

export const useNotifications = () => {
    const { user } = useContext(AuthContext);
    const [notificationSettings, setNotificationSettings] = useState({
        granted: false,
        canAskAgain: true,
        status: 'undetermined'
    });
    const [pushToken, setPushToken] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Inizializza le notifiche quando l'utente fa login
    useEffect(() => {
        if (user && !isInitialized) {
            initializeNotifications();
        }
    }, [user, isInitialized]);

    // Cleanup quando l'utente fa logout
    useEffect(() => {
        if (!user && isInitialized) {
            setIsInitialized(false);
            setPushToken(null);
            setNotificationSettings({
                granted: false,
                canAskAgain: true,
                status: 'undetermined'
            });
        }
    }, [user, isInitialized]);

    const initializeNotifications = async () => {
        try {
            const token = await notificationService.initialize();
            const settings = await notificationService.getNotificationSettings();
            
            setPushToken(token);
            setNotificationSettings(settings);
            setIsInitialized(true);
            
            console.log('✅ useNotifications initialized');
        } catch (error) {
            console.error('❌ Error initializing notifications:', error);
        }
    };

    const requestPermissions = async () => {
        try {
            const token = await notificationService.initialize();
            const settings = await notificationService.getNotificationSettings();
            
            setPushToken(token);
            setNotificationSettings(settings);
            
            return settings.granted;
        } catch (error) {
            console.error('Error requesting permissions:', error);
            return false;
        }
    };

    // Funzioni specifiche per il business

    /**
     * Notifica SuperAdmin di nuova richiesta registrazione
     */
    const notifyNewRegistrationRequest = async (requestData) => {
        if (!isInitialized || !notificationSettings.granted) return false;
        
        try {
            await notificationService.notifyNewRegistrationRequest(requestData);
            return true;
        } catch (error) {
            console.error('Error sending registration notification:', error);
            return false;
        }
    };

    /**
     * Notifica aggiornamento stato ordine
     */
    const notifyOrderUpdate = async (orderData) => {
        if (!isInitialized || !notificationSettings.granted) return false;
        
        try {
            await notificationService.notifyOrderUpdate(orderData);
            return true;
        } catch (error) {
            console.error('Error sending order notification:', error);
            return false;
        }
    };

    /**
     * Notifica inventario basso
     */
    const notifyLowInventory = async (productData) => {
        if (!isInitialized || !notificationSettings.granted) return false;
        
        try {
            await notificationService.notifyLowInventory(productData);
            return true;
        } catch (error) {
            console.error('Error sending inventory notification:', error);
            return false;
        }
    };

    /**
     * Invia notifica personalizzata
     */
    const sendCustomNotification = async (title, body, data = {}) => {
        if (!isInitialized || !notificationSettings.granted) return false;
        
        try {
            await notificationService.sendLocalNotification(title, body, data);
            return true;
        } catch (error) {
            console.error('Error sending custom notification:', error);
            return false;
        }
    };

    /**
     * Controlla se l'utente può ricevere notifiche per un certo tipo
     */
    const canReceiveNotificationType = (notificationType) => {
        if (!isInitialized || !notificationSettings.granted || !user) return false;
        
        switch (notificationType) {
            case 'registration_requests':
                return user.role === 'superadmin';
            
            case 'order_updates':
                return ['superadmin', 'admin', 'manager'].includes(user.role);
            
            case 'inventory_alerts':
                return ['superadmin', 'admin', 'manager', 'employee'].includes(user.role);
            
            case 'general':
                return true;
            
            default:
                return false;
        }
    };

    /**
     * Ottiene statistiche notifiche per l'utente corrente
     */
    const getNotificationStats = () => {
        return {
            isInitialized,
            hasPermissions: notificationSettings.granted,
            canAskAgain: notificationSettings.canAskAgain,
            pushToken: pushToken ? pushToken.substring(0, 20) + '...' : null,
            userRole: user?.role || 'none',
            availableTypes: {
                registrationRequests: canReceiveNotificationType('registration_requests'),
                orderUpdates: canReceiveNotificationType('order_updates'),
                inventoryAlerts: canReceiveNotificationType('inventory_alerts'),
                general: canReceiveNotificationType('general'),
            }
        };
    };

    return {
        // Stato
        isInitialized,
        notificationSettings,
        pushToken,
        
        // Azioni
        requestPermissions,
        
        // Notifiche business-specific
        notifyNewRegistrationRequest,
        notifyOrderUpdate,
        notifyLowInventory,
        sendCustomNotification,
        
        // Utilità
        canReceiveNotificationType,
        getNotificationStats,
    };
};