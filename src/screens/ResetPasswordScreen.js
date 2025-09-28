import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import FloatingToast from '../components/FloatingToast';
import { API_URL } from '../config';
import { AuthContext } from '../context/AuthContext';

export default function ResetPasswordScreen({ route, navigation }) {
  const [token, setToken] = useState(route?.params?.token || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => {
    // try to parse token from initial URL (querystring) if not provided
    if (!token) {
      (async () => {
        try {
          const url = await Linking.getInitialURL();
          if (url) {
            const q = url.split('?')[1] || '';
            const params = new URLSearchParams(q);
            const t = params.get('token');
            if (t) setToken(t);
          }
        } catch (e) { /* ignore */ }
      })();
    }
  }, []);

  const showToast = (m, t = 'success') => setToast({ visible: true, message: m, type: t });
  const { logout, user } = useContext(AuthContext);

  const handleReset = async () => {
    if (!token) return showToast('Token mancante. Incolla il token o usa il link dall\'email', 'error');
    if (!password || password.length < 8) return showToast('La password deve avere almeno 8 caratteri', 'error');
    if (password !== confirm) return showToast('Le password non coincidono', 'error');
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: password }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Password aggiornata. Effettua il login.', 'success');
        // Ensure we land on the login screen. If we're in an authenticated stack, force logout
        try {
          if (user) {
            // logout will update AuthContext and cause RootNavigator to render the unauthenticated stack
            await logout();
          } else {
            // if not authenticated, navigate to Login (this should be handled by RootNavigator too)
            try { navigation.navigate('Login'); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          // fallback: try to navigate to Login
          try { navigation.navigate('Login'); } catch (err) { /* ignore */ }
        }
      } else {
        showToast(b.error || 'Errore reset password', 'error');
      }
    } catch (e) {
      console.error('Reset error', e);
      showToast('Errore comunicazione con il server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={{ marginBottom: 8 }}>Incolla il token ricevuto (se il link non funziona) oppure apri il link nell'app.</Text>
      <TextInput label="Token" value={token} onChangeText={setToken} multiline style={styles.input} />
      <TextInput label="Nuova password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
      <TextInput label="Conferma nuova password" secureTextEntry value={confirm} onChangeText={setConfirm} style={styles.input} />
      <Button mode="contained" onPress={handleReset} loading={loading} disabled={loading} style={{ marginTop: 10 }}>Imposta nuova password</Button>

      <FloatingToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast({ ...toast, visible: false })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { marginBottom: 12 },
});
