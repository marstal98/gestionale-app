/**
 * Test script per verificare il funzionamento del sistema di notifiche
 */

// Import fetch for Node.js
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

const BACKEND_URL = 'http://localhost:8082';

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
                'Authorization': 'Bearer your-test-token' // Sostituisci con un token valido
            },
            body: JSON.stringify({
                token: 'ExponentPushToken[TEST-TOKEN-123]',
                platform: 'android'
            })
        });

        if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json();
            console.log('✅ Token registrato:', tokenResult);
        } else {
            console.log('❌ Errore registrazione token:', await tokenResponse.text());
        }

        // Test 2: Invio notifica a un ruolo specifico
        console.log('\n📤 Test 2: Invio notifica di test...');
        const notificationResponse = await fetch(`${BACKEND_URL}/api/notifications/send-to-role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your-test-token' // Sostituisci con un token valido
            },
            body: JSON.stringify({
                role: 'superadmin',
                title: 'Test Notifica',
                body: 'Questa è una notifica di test dal sistema',
                data: { type: 'test', timestamp: Date.now() }
            })
        });

        if (notificationResponse.ok) {
            const notificationResult = await notificationResponse.json();
            console.log('✅ Notifica inviata:', notificationResult);
        } else {
            console.log('❌ Errore invio notifica:', await notificationResponse.text());
        }

        // Test 3: Test specifico per nuova registrazione
        console.log('\n👤 Test 3: Notifica nuova registrazione...');
        const registrationResponse = await fetch(`${BACKEND_URL}/api/notifications/new-registration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your-test-token' // Sostituisci con un token valido
            },
            body: JSON.stringify({
                userName: 'Mario Rossi',
                userEmail: 'mario.rossi@example.com',
                requestedRole: 'user'
            })
        });

        if (registrationResponse.ok) {
            const registrationResult = await registrationResponse.json();
            console.log('✅ Notifica registrazione inviata:', registrationResult);
        } else {
            console.log('❌ Errore notifica registrazione:', await registrationResponse.text());
        }

    } catch (error) {
        console.error('❌ Errore durante i test:', error.message);
    }
}

// Verifica che il backend sia raggiungibile
async function checkBackendHealth() {
    try {
        console.log('🏥 Verificando lo stato del backend...');
        const response = await fetch(`${BACKEND_URL}/health`);
        
        if (response.ok) {
            console.log('✅ Backend raggiungibile');
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

// Funzione principale
async function runTests() {
    console.log('🚀 Avvio test del sistema di notifiche\n');
    
    const backendHealthy = await checkBackendHealth();
    
    if (backendHealthy) {
        await testNotificationApis();
    } else {
        console.log('\n❌ Impossibile eseguire i test: backend non disponibile');
        console.log('💡 Assicurati che il backend sia in esecuzione sulla porta 8082');
    }
    
    console.log('\n✨ Test completati!');
}

// Avvia i test se questo file viene eseguito direttamente
if (require.main === module) {
    runTests();
}

module.exports = { runTests, checkBackendHealth, testNotificationApis };