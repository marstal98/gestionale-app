import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, Title, Paragraph, Divider } from 'react-native-paper';
import notificationService from '../services/notificationService';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationTestScreen() {
    const [initStatus, setInitStatus] = useState('Non inizializzato');
    const [token, setToken] = useState(null);
    const { 
        notifyNewRegistrationRequest, 
        notifyOrderUpdate, 
        notifyLowInventory,
        isInitialized 
    } = useNotifications();

    useEffect(() => {
        initializeNotifications();
    }, []);

    const initializeNotifications = async () => {
        try {
            setInitStatus('Inizializzando...');
            const result = await notificationService.initialize();
            
            if (result) {
                setInitStatus('✅ Inizializzato');
                setToken(result);
            } else {
                setInitStatus('❌ Errore inizializzazione');
            }
        } catch (error) {
            setInitStatus('❌ Errore: ' + error.message);
            console.error('Errore inizializzazione:', error);
        }
    };

    const testNewRegistrationRequest = async () => {
        try {
            await notifyNewRegistrationRequest({
                id: Date.now(),
                username: 'Mario Rossi',
                email: 'mario.rossi@example.com',
                role: 'user'
            });
            Alert.alert('✅ Test completato', 'Notifica di nuova registrazione inviata');
        } catch (error) {
            Alert.alert('❌ Errore', error.message);
        }
    };

    const testOrderUpdate = async () => {
        try {
            await notifyOrderUpdate({
                id: '12345',
                status: 'in_progress'
            });
            Alert.alert('✅ Test completato', 'Notifica di aggiornamento ordine inviata');
        } catch (error) {
            Alert.alert('❌ Errore', error.message);
        }
    };

    const testInventoryAlert = async () => {
        try {
            await notifyLowInventory({
                id: 'prod_001',
                name: 'Prodotto Test',
                quantity: 5
            });
            Alert.alert('✅ Test completato', 'Notifica di inventario basso inviata');
        } catch (error) {
            Alert.alert('❌ Errore', error.message);
        }
    };

    const testCustomNotification = async () => {
        try {
            await notificationService.sendLocalNotification(
                '🧪 Test Personalizzato',
                'Questa è una notifica di test personalizzata',
                { type: 'custom_test', timestamp: Date.now() }
            );
            Alert.alert('✅ Test completato', 'Notifica personalizzata inviata');
        } catch (error) {
            Alert.alert('❌ Errore', error.message);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>🔔 Test Sistema Notifiche</Title>
                    <Paragraph>
                        Questa schermata ti permette di testare il sistema di notifiche 
                        anche in Expo Go utilizzando il simulatore.
                    </Paragraph>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>📊 Stato Sistema</Title>
                    <Text style={styles.statusText}>Stato: {initStatus}</Text>
                    <Text style={styles.statusText}>
                        Inizializzato: {isInitialized ? '✅ Sì' : '❌ No'}
                    </Text>
                    {token && (
                        <Text style={styles.tokenText}>
                            Token: {token.substring(0, 20)}...
                        </Text>
                    )}
                </Card.Content>
            </Card>

            <Divider style={styles.divider} />

            <Text style={styles.sectionTitle}>🧪 Test Notifiche Business</Text>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>👤 Nuova Registrazione</Title>
                    <Paragraph>
                        Simula una notifica per il SuperAdmin quando qualcuno 
                        richiede la registrazione all'app.
                    </Paragraph>
                </Card.Content>
                <Card.Actions>
                    <Button mode="contained" onPress={testNewRegistrationRequest}>
                        Testa Registrazione
                    </Button>
                </Card.Actions>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>📦 Aggiornamento Ordine</Title>
                    <Paragraph>
                        Simula una notifica quando lo stato di un ordine cambia.
                    </Paragraph>
                </Card.Content>
                <Card.Actions>
                    <Button mode="contained" onPress={testOrderUpdate}>
                        Testa Ordine
                    </Button>
                </Card.Actions>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>⚠️ Inventario Basso</Title>
                    <Paragraph>
                        Simula una notifica quando un prodotto ha scorte basse.
                    </Paragraph>
                </Card.Content>
                <Card.Actions>
                    <Button mode="contained" onPress={testInventoryAlert}>
                        Testa Inventario
                    </Button>
                </Card.Actions>
            </Card>

            <Divider style={styles.divider} />

            <Card style={styles.card}>
                <Card.Content>
                    <Title>🛠️ Test Personalizzato</Title>
                    <Paragraph>
                        Invia una notifica personalizzata per test generali.
                    </Paragraph>
                </Card.Content>
                <Card.Actions>
                    <Button mode="outlined" onPress={testCustomNotification}>
                        Test Personalizzato
                    </Button>
                </Card.Actions>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>🔄 Reinizializza</Title>
                    <Paragraph>
                        Reinizializza il sistema di notifiche se necessario.
                    </Paragraph>
                </Card.Content>
                <Card.Actions>
                    <Button mode="outlined" onPress={initializeNotifications}>
                        Reinizializza
                    </Button>
                </Card.Actions>
            </Card>

            <View style={styles.spacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 16,
    },
    card: {
        marginBottom: 16,
        elevation: 4,
    },
    statusText: {
        fontSize: 16,
        marginBottom: 8,
        color: '#333',
    },
    tokenText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'monospace',
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginVertical: 16,
        textAlign: 'center',
    },
    divider: {
        marginVertical: 16,
    },
    spacer: {
        height: 32,
    },
});