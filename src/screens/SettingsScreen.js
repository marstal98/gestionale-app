import React, { useState, useContext } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, Portal, Dialog, TextInput } from "react-native-paper";
import PasswordInput from '../components/PasswordInput';
import { AuthContext } from "../context/AuthContext";
import { buildHeaders } from '../utils/api';
import { API_URL } from "../config";
import { showToast } from '../utils/toastService';
import { safeMessageFromData } from '../utils/errorUtils';

export default function SettingsScreen() {
  const { token, logout } = useContext(AuthContext) || {};
  const [changeVisible, setChangeVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  // use global showToast

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) return showToast('Compila tutti i campi', 'error');
    if (newPwd.length < 8) return showToast('La nuova password deve avere almeno 8 caratteri', 'error');
    if (newPwd !== confirmPwd) return showToast('Le password non coincidono', 'error');

    try {
      if (!token) {
        // No token — local success for MVP
        showToast('Password aggiornata (modalità locale)', 'success');
        setChangeVisible(false);
        setOldPwd(''); setNewPwd(''); setConfirmPwd('');
        return;
      }
      const res = await fetch(`${API_URL}/users/change-password`, {
        method: 'POST',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const body = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Password aggiornata', 'success');
      setChangeVisible(false);
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
        // if server requests force logout, do it
        if (body && body.forceLogout && typeof logout === 'function') {
          logout();
        }
      } else {
        const safe = safeMessageFromData(body || {}, 'Errore cambio password');
        showToast(safe, 'error');
      }
    } catch (e) {
      console.error('Change password error', e);
      showToast('Errore server', 'error');
    }
  };

  const handleSendTestEmail = async () => {
    try {
      if (!token) return showToast('Devi essere autenticato per inviare la mail di test', 'error');
  const res = await fetch(`${API_URL}/users/send-test`, { method: 'POST', headers: buildHeaders(token) });
      if (res.ok) {
  showToast('Email di test inviata', 'success');
      } else {
    const b = await res.json().catch(() => ({}));
  const safe = safeMessageFromData(b || {}, 'Invio mail fallito');
  showToast(safe, 'error');
      }
    } catch (e) {
      console.error('Send test email error', e);
  showToast('Errore server durante invio', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni ⚙️</Text>
      <Button mode="outlined" onPress={() => setChangeVisible(true)}>Cambia password</Button>
  <Button mode="contained" onPress={handleSendTestEmail} style={{ marginTop: 16 }}>Invia mail di test</Button>

      <Portal>
        <Dialog visible={changeVisible} onDismiss={() => setChangeVisible(false)}>
          <Dialog.Title>Cambia password</Dialog.Title>
          <Dialog.Content>
            <PasswordInput label="Password attuale" value={oldPwd} onChangeText={setOldPwd} />
            <PasswordInput label="Nuova password" value={newPwd} onChangeText={setNewPwd} style={{ marginTop: 10 }} />
            <PasswordInput label="Conferma nuova password" value={confirmPwd} onChangeText={setConfirmPwd} style={{ marginTop: 10 }} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChangeVisible(false)}>Annulla</Button>
            <Button onPress={handleChangePassword}>Salva</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

  {/* global FloatingToast host */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 15,
    color: "#222",
  },
});
