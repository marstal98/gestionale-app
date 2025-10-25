/**
 * Test semplice per verificare il backend delle notifiche
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:4000'; // Porta corretta del backend

// Verifica che il backend sia raggiungibile
async function checkBackendHealth() {
    try {
        console.log('🏥 Verificando lo stato del backend...');
        const response = await fetch(`${BACKEND_URL}/health`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend raggiungibile:', data);
            return true;
        } else {
            console.log('❌ Backend non risponde correttamente');
            return false;
        }
    } catch (error) {
        console.log('❌ Backend non raggiungibile:', error.message);
        return false;
    }
}

// Test delle API di notifica
async function testNotificationApis() {
    console.log('🧪 Testando le API di notifica...\n');

    try {
        // Test 1: Registrazione di un token fittizio
        console.log('📱 Test 1: Registrazione token...');
        const tokenResponse = await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({
                token: 'ExponentPushToken[TEST-TOKEN-123]',
                platform: 'android'
            })
        });

        console.log('Status registrazione token:', tokenResponse.status);
        if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json();
            console.log('✅ Token registrato:', tokenResult);
        } else {
            const errorText = await tokenResponse.text();
            console.log('❌ Errore registrazione token:', errorText);
        }

        // Test 2: Invio notifica a un ruolo specifico
        console.log('\n📤 Test 2: Invio notifica di test...');
        const notificationResponse = await fetch(`${BACKEND_URL}/api/notifications/send-to-role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({
                role: 'superadmin',
                title: 'Test Notifica',
                body: 'Questa è una notifica di test dal sistema',
                data: { type: 'test', timestamp: Date.now() }
            })
        });

        console.log('Status invio notifica:', notificationResponse.status);
        if (notificationResponse.ok) {
            const notificationResult = await notificationResponse.json();
            console.log('✅ Notifica inviata:', notificationResult);
        } else {
            const errorText = await notificationResponse.text();
            console.log('❌ Errore invio notifica:', errorText);
        }

    } catch (error) {
        console.error('❌ Errore durante i test:', error.message);
    }
}

// Funzione principale
async function runTests() {
    console.log('🚀 Avvio test del sistema di notifiche\n');
    
    const backendHealthy = await checkBackendHealth();
    
    if (backendHealthy) {
        await testNotificationApis();
    } else {
        console.log('\n❌ Impossibile eseguire i test: backend non disponibile');
        console.log('💡 Assicurati che il backend sia in esecuzione sulla porta 4000');
    }
    
    console.log('\n✨ Test completati!');
}

runTests();