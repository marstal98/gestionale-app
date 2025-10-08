import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { showToast } from '../utils/toastService';
import { safeMessageFromData } from '../utils/errorUtils';
import { API_URL } from '../config';
import PasswordInput from '../components/PasswordInput';
import { AuthContext } from '../context/AuthContext';

export default function AcceptInviteScreen({ route, navigation }) {
  const token = route?.params?.token || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  // use global showToast
  const { login } = useContext(AuthContext);

  useEffect(() => {
    if (!token) {
      showToast('Token mancante', 'error');
    }
  }, [token]);

  const submit = async () => {
  if (!password || password.length < 8) return showToast('La password deve avere almeno 8 caratteri', 'error');
  if (password !== confirm) return showToast('Le password non corrispondono', 'error');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        // server should return jwt and refreshToken and user
        try {
          await login(b);
        } catch (e) {
          // If login fails, just navigate to Login
          navigation.navigate('Login');
        }
      } else {
        const safe = safeMessageFromData(b || {}, 'Errore accettazione invito');
        showToast(safe, 'error');
      }
    } catch (e) {
      console.error('Accept invite error', e);
  showToast('Impossibile contattare il server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accetta invito</Text>
      <Text style={styles.subtitle}>Imposta una password per il tuo account</Text>
  <PasswordInput label="Password" value={password} onChangeText={setPassword} style={styles.input} required showError={false} onBlur={() => { if (!password || password.length < 8) showToast('La password deve avere almeno 8 caratteri', 'error'); }} />
  <PasswordInput label="Conferma password" value={confirm} onChangeText={setConfirm} style={styles.input} required showError={false} onBlur={() => { if (confirm !== password) showToast('Le password non corrispondono', 'error'); }} />
      <Button mode="contained" onPress={submit} loading={loading} disabled={loading} style={styles.button}>Attiva account</Button>
  {/* global FloatingToast host */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 12, color: '#666' },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
});
