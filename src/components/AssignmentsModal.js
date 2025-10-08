import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Modal, Portal, Button, Text, Checkbox, ActivityIndicator, Searchbar, Surface } from 'react-native-paper';
import { API_URL } from '../config';
import { buildHeaders } from '../utils/api';

export default function AssignmentsModal({ visible, employee, token, onDismiss, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible && employee) {
      fetchData();
    } else {
      setCustomers([]);
      setSelected(new Set());
    }
  }, [visible, employee]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // fetch customers list (server should return customers visible to admin)
      const res = await fetch(`${API_URL}/users?role=customer`, {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        // ensure we only display users with role 'customer' (server may return mixed roles)
        let onlyCustomers = Array.isArray(data) ? data.filter((u) => u.role === 'customer') : [];
        // also ensure we don't include the employee itself (defensive)
        if (employee && employee.id) onlyCustomers = onlyCustomers.filter((u) => u.id !== employee.id);
        setCustomers(onlyCustomers);
        // fetch existing assignments for this employee
        const aRes = await fetch(`${API_URL}/assignments?employeeId=${employee.id}`, {
          headers: buildHeaders(token),
        });
        const existing = aRes.ok ? await aRes.json() : [];
        const assignedSet = new Set(existing.map((r) => r.customerId));
        setSelected(assignedSet);
      }
    } catch (err) {
      console.error('Errore fetch customers or assignments', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const save = async () => {
    setLoading(true);
    try {
      // compute diffs: get currently assigned from server again to avoid races
      const aRes = await fetch(`${API_URL}/assignments?employeeId=${employee.id}`, {
        headers: buildHeaders(token),
      });
      const existing = aRes.ok ? await aRes.json() : [];
      const existingSet = new Set(existing.map((r) => r.customerId));

      // additions
      const toAdd = Array.from(selected).filter((id) => !existingSet.has(id));
      // removals
      const toRemove = Array.from(existingSet).filter((id) => !selected.has(id));

      // perform adds
      for (const cid of toAdd) {
        await fetch(`${API_URL}/assignments`, {
          method: 'POST',
          headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ customerId: cid, employeeId: employee.id }),
        });
      }

      // perform deletes
      for (const cid of toRemove) {
        await fetch(`${API_URL}/assignments`, {
          method: 'DELETE',
          headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ customerId: cid, employeeId: employee.id }),
        });
      }

      onSaved && onSaved();
    } catch (err) {
      console.error('Errore save assignments', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s);
  });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Surface style={styles.surface}>
          <View style={{ padding: 12 }}>
            <Text style={{ fontSize: 18, marginBottom: 8 }}>Assegna clienti a {employee?.name}</Text>
            <Searchbar
              placeholder="Cerca clienti"
              value={search}
              onChangeText={setSearch}
              style={styles.searchbar}
            />

            {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

            {!loading && (
              <FlatList
                data={filtered}
                keyExtractor={(it) => it.id.toString()}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 6 }}
                renderItem={({ item }) => (
                  <TouchableItem onPress={() => toggle(item.id)}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemText}>{item.name} — {item.email}</Text>
                      <Checkbox
                        status={selected.has(item.id) ? 'checked' : 'unchecked'}
                        onPress={() => toggle(item.id)}
                      />
                    </View>
                  </TouchableItem>
                )}
              />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onPress={onDismiss} style={{ marginRight: 8 }}>Annulla</Button>
              <Button mode="contained" onPress={save} loading={loading}>Salva</Button>
            </View>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
}

const TouchableItem = ({ children, onPress }) => (
  <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ marginBottom: 8 }}>
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  surface: { width: '94%', maxWidth: 640, maxHeight: '98%', borderRadius: 14, backgroundColor: '#fff', padding: 6, elevation: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  searchbar: { marginVertical: 8, borderRadius: 26, overflow: 'hidden', height: 46, backgroundColor: '#F3ECF9' },
  list: { marginTop: 8, paddingHorizontal: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 28, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width:0, height:2 } },
  itemText: { flex: 1, marginRight: 12, fontSize: 15 },
});
