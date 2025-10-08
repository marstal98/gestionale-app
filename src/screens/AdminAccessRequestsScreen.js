import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, Button, Portal, Dialog } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';
import { buildHeaders } from '../utils/api';
import { showToast } from '../utils/toastService';
import { safeMessageFromData } from '../utils/errorUtils';

export default function AdminAccessRequestsScreen({ route, navigation, onPendingCountChange }) {
  const { token } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // use global showToast
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'accepted' | 'rejected'

  const fetchRequests = async () => {
    try {
      setLoading(true);
    const res = await fetch(`${API_URL}/access-requests`, { headers: buildHeaders(token) });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setRequests(data);
        // notify parent about pending count
        const pendingCount = Array.isArray(data) ? data.filter(d => d.status === 'pending').length : 0;
        if (typeof onPendingCountChange === 'function') onPendingCountChange(pendingCount);
      }
    } catch (e) {
      console.error('Fetch access requests error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchRequests();
  }, [token]);

  useEffect(() => {
    // if opened with an id param, open the dialog
    const id = route?.params?.id;
    if (id && requests.length > 0) {
      const found = requests.find(r => String(r.id) === String(id));
      if (found) setSelected(found);
    }
  }, [route?.params?.id, requests]);

  // local showToast removed; use global showToast

  const handleAction = async (r, action) => {
    try {
      const res = await fetch(`${API_URL}/access-requests/${r.id}/handle`, {
        method: 'POST',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
  showToast(`Richiesta ${action} con successo`, 'success');
        fetchRequests();
        setSelected(null);
      } else {
        const safe = safeMessageFromData(b || {}, 'Errore');
        showToast(safe, 'error');
      }
    } catch (e) {
      console.error('Handle access request error', e);
  showToast('Errore server', 'error');
    }
  };

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: '#F9F9FB', marginTop: 24 }}>
      {/* Filter controls */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
        <Button mode={filter === 'accepted' ? 'contained' : 'outlined'} onPress={() => setFilter('accepted')}>Accettate</Button>
        <Button mode={filter === 'rejected' ? 'contained' : 'outlined'} onPress={() => setFilter('rejected')}>Rifiutate</Button>
        <Button mode={filter === 'pending' ? 'contained' : 'outlined'} onPress={() => setFilter('pending')}>In corso</Button>
        <Button mode={filter === 'all' ? 'contained' : 'outlined'} onPress={() => setFilter('all')}>Tutte</Button>
      </View>

      <FlatList
        data={requests.filter(r => {
          if (filter === 'all') return true;
          if (filter === 'pending') return r.status === 'pending';
          return r.status === filter;
        })}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={fetchRequests}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.name}>{item.name || '(anonimo)'}</Text>
              <Text>Email: {item.email}</Text>
              <Text>Azienda: {item.company || '-'}</Text>
              <Text>Messaggio: {item.message || '-'}</Text>
              <Text>Creato: {new Date(item.createdAt).toLocaleString()}</Text>
              <Text>Stato: {item.status}</Text>
            </Card.Content>
            <Card.Actions style={{ justifyContent: 'flex-end' }}>
              {item.status === 'pending' ? (
                <>
                  <Button mode="contained" onPress={() => handleAction(item, 'accept')} style={{ marginLeft: 8 }}>Accetta</Button>
                  <Button mode="outlined" onPress={() => handleAction(item, 'reject')} style={{ marginLeft: 8 }}>Rifiuta</Button>
                </>
              ) : (
                <Text style={{ color: '#777', marginRight: 8 }}>Elaborata: {item.status}</Text>
              )}
            </Card.Actions>
          </Card>
        )}
      />

      <Portal>
        <Dialog visible={!!selected} onDismiss={() => setSelected(null)}>
          <Dialog.Title>Valuta richiesta</Dialog.Title>
          <Dialog.Content>
            {selected && (
              <View>
                <Text style={{ fontWeight: '600' }}>{selected.name || '(anonimo)'}</Text>
                <Text>Email: {selected.email}</Text>
                <Text>Azienda: {selected.company || '-'}</Text>
                <Text>Messaggio: {selected.message || '-'}</Text>
                <Text>Creato: {new Date(selected.createdAt).toLocaleString()}</Text>
                <Text>Stato: {selected.status}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            {selected && selected.status === 'pending' ? (
              <>
                <Button onPress={() => selected && handleAction(selected, 'reject')} textColor="red">Rifiuta</Button>
                <Button onPress={() => selected && handleAction(selected, 'accept')}>Accetta</Button>
              </>
            ) : (
              <Button onPress={() => setSelected(null)}>Chiudi</Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

  {/* global FloatingToast host */}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, borderRadius: 10, backgroundColor: '#fff' },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
});
