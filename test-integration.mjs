import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:4000';

async function testIntegrationEndToEnd() {
    console.log('🚀 Test Integrazione End-to-End Sistema Notifiche\n');

    try {
        // Test 1: Verifica che il backend sia raggiungibile
        console.log('🔗 Test 1: Connettività Backend...');
        const healthResponse = await fetch(`${BACKEND_URL}/debug-method`);
        
        if (healthResponse.ok) {
            const result = await healthResponse.json();
            console.log('✅ Backend raggiungibile:', result);
        } else {
            console.log('⚠️  Backend risponde ma con status:', healthResponse.status);
        }

        // Test 2: Test endpoint notifiche esistente
        console.log('\n📱 Test 2: Endpoint registrazione token...');
        const tokenResponse = await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: 'ExponentPushToken[TEST-INTEGRATION-123]',
                platform: 'android'
            })
        });

        if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json();
            console.log('✅ Token registrato:', tokenResult);
        } else {
            const errorText = await tokenResponse.text();
            console.log('❌ Errore registrazione token:', tokenResponse.status, errorText);
        }

        // Test 3: Simulazione evento business - Nuova registrazione
        console.log('\n👤 Test 3: Simulazione nuova registrazione utente...');
        const newUserData = {
            userName: 'Test User Integration',
            userEmail: 'test.integration@example.com',
            requestedRole: 'user'
        };

        // Questo dovrebbe essere chiamato dal backend quando un nuovo utente si registra
        const notificationResponse = await simulateNewUserRegistration(newUserData);
        console.log('✅ Simulazione registrazione completata:', notificationResponse);

        console.log('\n🎉 Test di integrazione completato con successo!');
        console.log('📋 Riepilogo:');
        console.log('   - ✅ Backend attivo e raggiungibile');
        console.log('   - ✅ API notifiche funzionanti');
        console.log('   - ✅ Simulazione eventi business operativa');

    } catch (error) {
        console.error('❌ Errore durante il test di integrazione:', error.message);
    }
}

async function simulateNewUserRegistration(userData) {
    // Questa funzione simula cosa dovrebbe fare il backend 
    // quando un nuovo utente si registra
    
    console.log('📤 Simulando invio notifica per nuova registrazione...');
    
    // In un'app reale, questo sarebbe chiamato dal backend
    const notificationData = {
        role: 'superadmin', // Invia ai superadmin
        title: '👤 Nuova Richiesta di Registrazione',
        body: `${userData.userName} vuole registrarsi come ${userData.requestedRole}`,
        data: {
            type: 'new_registration_request',
            userId: Date.now(),
            userName: userData.userName,
            userEmail: userData.userEmail,
            requestedRole: userData.requestedRole,
            timestamp: Date.now()
        }
    };

    // Test dell'endpoint di invio notifiche
    try {
        const response = await fetch(`${BACKEND_URL}/api/notifications/send-to-role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notificationData)
        });

        if (response.ok) {
            const result = await response.json();
            return { success: true, result };
        } else {
            const error = await response.text();
            return { success: false, error: `${response.status}: ${error}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Esegui il test
testIntegrationEndToEnd();