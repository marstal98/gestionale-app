import React, { useState, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, TextInput as PaperTextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import RequiredTextInput from './RequiredTextInput';
import { API_URL } from '../config';
import { buildHeaders } from '../utils/api';
import { SyncContext } from '../context/SyncContext';
import { showToast } from '../utils/toastService';
import { safeMessageFromData } from '../utils/errorUtils';

export default function CreateCustomerModal({ visible, onDismiss, token, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  

  const { triggerRefresh } = useContext(SyncContext);

  const create = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
  if (res.status === 201) {
        // Invitation created — inform the caller and show a confirmation message
        onCreated && onCreated(data);
        try { triggerRefresh(); } catch (e) { /* ignore */ }
        setName(''); setEmail(''); setPhone('');
        // show a short confirmation instead of closing immediately so operator
        // sees that an invite email was sent. Keep modal open for a moment.
        setSuccessMessage('Invito inviato: il cliente riceverà un' + "'" + 'email con le istruzioni per impostare la password.');
        setTimeout(() => { onDismiss && onDismiss(); setSuccessMessage(''); }, 2200);
  } else if (res.status === 409 && data && data.existing) {
        // server reports existing email — show global toast and return existing user so caller can decide
        showToast('Email già registrata nel sistema', 'error');
        onCreated && onCreated({ existing: true, user: data.user });
      } else {
  // sanitize server message and keep inline error for form display
  const safe = safeMessageFromData(data || {}, 'Errore creazione cliente');
  setError(safe);
      }
    } catch (e) {
      console.error('Create customer error', e);
      setError('Impossibile contattare il server');
    } finally { setLoading(false); }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Crea nuovo cliente</Text>
          <RequiredTextInput label="Nome" name="Nome" required value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
          <RequiredTextInput label="Email" name="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" style={{ marginBottom: 8 }} />
          <PaperTextInput label="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={{ marginBottom: 8 }} />
          {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}
          {successMessage ? <Text style={{ color: 'green', marginBottom: 8 }}>{successMessage}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button onPress={onDismiss} disabled={loading} style={{ marginRight: 8 }}>Annulla</Button>
            <Button mode="contained" onPress={create} loading={loading}>Crea</Button>
          </View>
        </View>
    </Modal>
    {/* toasts are handled by global host */}
    </Portal>
  );
}

const styles = StyleSheet.create({ modal: { backgroundColor: '#fff', margin: 20, padding: 12, borderRadius: 10 } });
