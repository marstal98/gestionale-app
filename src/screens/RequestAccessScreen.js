import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import RequiredTextInput from '../components/RequiredTextInput';
import { showToast } from '../utils/toastService';
import { safeMessageFromData } from '../utils/errorUtils';
import { API_URL } from '../config';

export default function RequestAccessScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  // use global toast

  const submit = async () => {
  if (!email) return showToast('Inserisci un\'email', 'error');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company }),
      });
    if (res.ok) {
      showToast('Richiesta inviata. Verrai contattato dall\'amministratore.', 'success');
        setName(''); setEmail(''); setCompany('');
        // optionally navigate back after a short delay
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        const b = await res.json().catch(() => ({}));
        if (res.status === 409 && b && b.existing && b.user) {
          // Email already exists in system
          showToast('Email già registrata. Se è la tua, effettua il login oppure contatta l\'amministratore.', 'error');
          console.log('Existing user during access request:', b.user);
    } else {
      const safe = safeMessageFromData(b || {}, 'Errore invio richiesta');
  showToast(safe, 'error');
    }
      }
    } catch (e) {
      console.error('RequestAccess error', e);
      showToast('Impossibile contattare il server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Richiedi accesso</Text>
  <RequiredTextInput label="Nome e cognome" name="Nome e cognome" required value={name} onChangeText={setName} style={styles.input} />
  <RequiredTextInput label="Email" name="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" style={styles.input} />
  <TextInput label="Azienda (opzionale)" value={company} onChangeText={setCompany} style={styles.input} />
      <Button mode="contained" onPress={submit} loading={loading} disabled={loading} style={styles.button}>Invia richiesta</Button>
  {/* global FloatingToast host handles toasts */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
});
