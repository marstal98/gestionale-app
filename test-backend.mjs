import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:4000';

async function testBackend() {
    console.log('🔍 Testando le API del backend...\n');

    try {
        // Test 1: Test un endpoint qualsiasi per verificare che il server risponda
        console.log('🏥 Test 1: Test connettività backend...');
        const testResponse = await fetch(`${BACKEND_URL}/debug-method`, {
            method: 'GET'
        });
        
        if (testResponse.ok) {
            const testResult = await testResponse.json();
            console.log('✅ Backend funzionante:', testResult);
        } else {
            console.log('❌ Test connettività fallito:', testResponse.status);
        }

        // Test 2: Test endpoint notifiche (senza auth per ora)
        console.log('\n📱 Test 2: Endpoint notifiche...');
        const notifResponse = await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: 'ExponentPushToken[TEST-123]',
                platform: 'android'
            })
        });

        console.log('Status:', notifResponse.status);
        const notifResult = await notifResponse.text();
        console.log('Response:', notifResult);

    } catch (error) {
        console.error('❌ Errore durante i test:', error.message);
    }
}

testBackend();