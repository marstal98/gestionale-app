import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Chip, 
  List, 
  ActivityIndicator,
  Snackbar,
  Surface 
} from 'react-native-paper';
import { useBackendHealth, useApi } from '../hooks/useApi';
import apiService from '../services/apiService';
import { AuthContext } from '../context/AuthContext';
import { 
  useResponsive, 
  wp, 
  hp, 
  getSpacing, 
  getComponentSize, 
  scaleFontSize, 
  createResponsiveStyles 
} from '../utils/responsive';

export default function BackendIntegrationTest() {
  const { isConnected, checking, checkHealth } = useBackendHealth();
  const { token, user } = useContext(AuthContext);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const { isTablet, deviceType } = useResponsive();

  // Sincronizza il token con apiService ogni volta che cambia
  useEffect(() => {
    console.log('🔑 Debug BackendIntegrationTest - token:', token ? 'PRESENTE' : 'ASSENTE');
    console.log('🔑 Debug BackendIntegrationTest - user:', user ? `${user.email} (${user.role})` : 'ASSENTE');
    
    if (token) {
      apiService.setToken(token);
      console.log('🔑 Token sincronizzato con apiService per i test');
    } else {
      apiService.setToken(null);
      console.log('🔑 Token rimosso da apiService');
    }
  }, [token, user]);

  // Test di connessione base
  const testConnection = async () => {
    try {
      setTesting(true);
      const result = await checkHealth();
      setTestResults(prev => ({
        ...prev,
        connection: result ? 'SUCCESS' : 'FAILED'
      }));
      showSnackbar(result ? 'Connessione OK' : 'Connessione fallita');
    } catch (error) {
      setTestResults(prev => ({ ...prev, connection: 'ERROR' }));
      showSnackbar('Errore connessione');
    } finally {
      setTesting(false);
    }
  };

  // Test endpoint prodotti
  const testProducts = async () => {
    if (!token || !user) {
      setTestResults(prev => ({ ...prev, products: 'ERROR: Richiede autenticazione' }));
      showSnackbar('Effettua il login per testare questo endpoint');
      return;
    }
    
    try {
      setTesting(true);
      const products = await apiService.getProducts();
      setTestResults(prev => ({
        ...prev,
        products: `SUCCESS (${products.length} prodotti)`
      }));
      showSnackbar(`Caricati ${products.length} prodotti`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, products: `ERROR: ${error.message}` }));
      showSnackbar('Errore caricamento prodotti');
    } finally {
      setTesting(false);
    }
  };

  // Test endpoint ordini
  const testOrders = async () => {
    if (!token || !user) {
      setTestResults(prev => ({ ...prev, orders: 'ERROR: Richiede autenticazione' }));
      showSnackbar('Effettua il login per testare questo endpoint');
      return;
    }
    
    try {
      setTesting(true);
      const orders = await apiService.getOrders();
      setTestResults(prev => ({
        ...prev,
        orders: `SUCCESS (${orders.length} ordini)`
      }));
      showSnackbar(`Caricati ${orders.length} ordini`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, orders: `ERROR: ${error.message}` }));
      showSnackbar('Errore caricamento ordini');
    } finally {
      setTesting(false);
    }
  };

  // Test endpoint utenti
  const testUsers = async () => {
    if (!token || !user) {
      setTestResults(prev => ({ ...prev, users: 'ERROR: Richiede autenticazione' }));
      showSnackbar('Effettua il login per testare questo endpoint');
      return;
    }
    
    try {
      setTesting(true);
      const users = await apiService.getUsers();
      setTestResults(prev => ({
        ...prev,
        users: `SUCCESS (${users.length} utenti)`
      }));
      showSnackbar(`Caricati ${users.length} utenti`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, users: `ERROR: ${error.message}` }));
      showSnackbar('Errore caricamento utenti');
    } finally {
      setTesting(false);
    }
  };

  // Test creazione prodotto di esempio
  const testCreateProduct = async () => {
    if (!token || !user) {
      setTestResults(prev => ({ ...prev, createProduct: 'ERROR: Richiede autenticazione' }));
      showSnackbar('Effettua il login per testare questo endpoint');
      return;
    }
    
    try {
      setTesting(true);
      const newProduct = {
        name: `Prodotto Test ${Date.now()}`,
        sku: `TEST-${Date.now()}`,
        price: 29.99,
        stock: 100
      };
      
      const result = await apiService.createProduct(newProduct);
      setTestResults(prev => ({
        ...prev,
        createProduct: `SUCCESS (ID: ${result.id})`
      }));
      showSnackbar('Prodotto creato con successo');
    } catch (error) {
      setTestResults(prev => ({ ...prev, createProduct: `ERROR: ${error.message}` }));
      showSnackbar('Errore creazione prodotto');
    } finally {
      setTesting(false);
    }
  };

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const getStatusColor = (status) => {
    if (status?.includes('SUCCESS')) return '#4CAF50';
    if (status?.includes('ERROR') || status?.includes('FAILED')) return '#F44336';
    return '#FF9800';
  };

  const getStatusIcon = (status) => {
    if (status?.includes('SUCCESS')) return '✅';
    if (status?.includes('ERROR') || status?.includes('FAILED')) return '❌';
    return '⏳';
  };

  const responsiveStyles = createResponsiveStyles(({ isTablet, getSpacing, scaleFontSize, getComponentSize }) => ({
    container: {
      flex: 1,
      padding: getSpacing(16),
      backgroundColor: '#f5f5f5',
    },
    contentContainer: {
      maxWidth: isTablet ? wp(80) : '100%',
      alignSelf: 'center',
      width: '100%'
    },
    title: {
      textAlign: 'center',
      marginBottom: getSpacing(20),
      fontWeight: 'bold',
      fontSize: scaleFontSize(20)
    },
    statusCard: {
      padding: getSpacing(16),
      marginBottom: getSpacing(16),
      borderRadius: getComponentSize('borderRadius'),
    },
    statusRow: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isTablet ? 'center' : 'flex-start',
      marginBottom: getSpacing(8),
    },
    statusChip: {
      paddingHorizontal: getSpacing(8),
      marginTop: isTablet ? 0 : getSpacing(8)
    },
    apiUrl: {
      color: '#666',
      fontFamily: 'monospace',
      fontSize: scaleFontSize(12)
    },
    testCard: {
      marginBottom: getSpacing(16),
    },
    testIcon: {
      fontSize: scaleFontSize(24),
      width: 40,
      textAlign: 'center',
    },
    testResult: {
      alignItems: 'flex-end',
      minWidth: 120,
    },
    actionsCard: {
      marginBottom: getSpacing(16),
    },
    buttonRow: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'space-around',
      gap: getSpacing(10),
    },
    button: {
      flex: isTablet ? 1 : undefined,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: getSpacing(20),
    },
    loadingText: {
      marginTop: getSpacing(10),
      fontSize: scaleFontSize(14)
    },
  }));

  return (
    <ScrollView 
      style={responsiveStyles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={responsiveStyles.contentContainer}>
        <Text variant="headlineMedium" style={responsiveStyles.title}>
          🔗 Test Integrazione Backend
        </Text>

        {/* Status connessione */}
        <Surface style={responsiveStyles.statusCard} elevation={2}>
          <View style={responsiveStyles.statusRow}>
            <Text variant="titleMedium">Stato Backend:</Text>
            {checking ? (
              <ActivityIndicator size="small" />
            ) : (
              <Chip 
                icon={isConnected ? "check-circle" : "alert-circle"}
                style={[responsiveStyles.statusChip, { 
                  backgroundColor: isConnected ? '#E8F5E8' : '#FFEBEE' 
                }]}
                textStyle={{ 
                  color: isConnected ? '#2E7D32' : '#C62828' 
                }}
              >
                {isConnected ? 'CONNESSO' : 'DISCONNESSO'}
              </Chip>
            )}
          </View>
          <View style={responsiveStyles.statusRow}>
            <Text variant="titleMedium">Autenticazione:</Text>
            <Chip 
              icon={token && user ? "account-check" : "account-alert"}
              style={[responsiveStyles.statusChip, { 
                backgroundColor: token && user ? '#E8F5E8' : '#FFF3E0' 
              }]}
              textStyle={{ 
                color: token && user ? '#2E7D32' : '#F57C00' 
              }}
            >
              {token && user ? `${user.role.toUpperCase()}` : 'NON AUTENTICATO'}
            </Chip>
          </View>
          <Text variant="bodySmall" style={responsiveStyles.apiUrl}>
            API: {apiService.baseURL}
          </Text>
          {user && (
            <Text variant="bodySmall" style={responsiveStyles.apiUrl}>
              Utente: {user.email} ({user.role})
            </Text>
          )}
        </Surface>

        {/* Test individuali */}
        <Card style={responsiveStyles.testCard}>
          <Card.Title title="🧪 Test Singoli" />
          <Card.Content>
            <List.Section>
              <List.Item
                title="Test Connessione Base"
                description="Verifica comunicazione server"
                left={() => <Text style={responsiveStyles.testIcon}>🔌</Text>}
                right={() => (
                  <View style={responsiveStyles.testResult}>
                    <Text style={{ color: getStatusColor(testResults.connection) }}>
                      {getStatusIcon(testResults.connection)} {testResults.connection || 'Non testato'}
                    </Text>
                  </View>
                )}
                onPress={testConnection}
                disabled={testing}
              />

              <List.Item
                title="Test Endpoint Prodotti"
                description="GET /api/products"
                left={() => <Text style={responsiveStyles.testIcon}>📦</Text>}
                right={() => (
                  <View style={responsiveStyles.testResult}>
                    <Text style={{ color: getStatusColor(testResults.products) }}>
                      {getStatusIcon(testResults.products)} {testResults.products || 'Non testato'}
                    </Text>
                  </View>
                )}
                onPress={testProducts}
                disabled={testing}
              />

              <List.Item
                title="Test Endpoint Ordini"
                description="GET /api/orders"
                left={() => <Text style={responsiveStyles.testIcon}>📋</Text>}
                right={() => (
                  <View style={responsiveStyles.testResult}>
                    <Text style={{ color: getStatusColor(testResults.orders) }}>
                      {getStatusIcon(testResults.orders)} {testResults.orders || 'Non testato'}
                    </Text>
                  </View>
                )}
                onPress={testOrders}
                disabled={testing}
              />

              <List.Item
                title="Test Endpoint Utenti"
                description="GET /api/users"
                left={() => <Text style={responsiveStyles.testIcon}>👥</Text>}
                right={() => (
                  <View style={responsiveStyles.testResult}>
                    <Text style={{ color: getStatusColor(testResults.users) }}>
                      {getStatusIcon(testResults.users)} {testResults.users || 'Non testato'}
                    </Text>
                  </View>
                )}
                onPress={testUsers}
                disabled={testing}
              />

              <List.Item
                title="Test Creazione Prodotto"
                description="POST /api/products"
                left={() => <Text style={responsiveStyles.testIcon}>➕</Text>}
                right={() => (
                  <View style={responsiveStyles.testResult}>
                    <Text style={{ color: getStatusColor(testResults.createProduct) }}>
                      {getStatusIcon(testResults.createProduct)} {testResults.createProduct || 'Non testato'}
                    </Text>
                  </View>
                )}
                onPress={testCreateProduct}
                disabled={testing}
              />
            </List.Section>
          </Card.Content>
        </Card>

        {/* Azioni rapide */}
        <Card style={responsiveStyles.actionsCard}>
          <Card.Title title="⚡ Azioni Rapide" />
          <Card.Content>
            <View style={responsiveStyles.buttonRow}>
              <Button 
                mode="contained" 
                onPress={async () => {
                  await testConnection();
                  await testProducts();
                  await testOrders();
                }}
                disabled={testing}
                style={responsiveStyles.button}
              >
                Test Tutti GET
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => setTestResults({})}
                style={responsiveStyles.button}
              >
                Reset Risultati
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Loading indicator */}
        {testing && (
          <View style={responsiveStyles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={responsiveStyles.loadingText}>
              Testing in corso...
            </Text>
          </View>
        )}

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
        >
          {snackbarMessage}
        </Snackbar>
      </View>
    </ScrollView>
  );
}

// Stili rimossi - ora usati responsiveStyles inline