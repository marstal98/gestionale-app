import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, SectionList, Dimensions, TouchableOpacity } from 'react-native';
import { Portal, Modal, Text, Button, TextInput, Chip, Divider, Checkbox, List, IconButton } from 'react-native-paper';

const STATUS_LABELS = {
  draft: 'Bozza',
  pending: 'In attesa',
  in_progress: 'Assegnato / In corso',
  completed: 'Completato',
  cancelled: 'Annullato'
};

export default function OrdersFilterModal({ visible, onDismiss, onApply, users = [], initial = {} }) {
  const [statusSet, setStatusSet] = useState(new Set(initial.status || []));
  // multi-select: arrays of ids (customers and assignees)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(initial.customers || []);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState(initial.assignees || []);
  const [custSearch, setCustSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  useEffect(() => {
    setStatusSet(new Set(initial.status || []));
    setSelectedCustomerIds(initial.customers || []);
    setSelectedAssigneeIds(initial.assignees || []);
    setCustSearch(''); setAssigneeSearch('');
  }, [initial, visible]);

  const toggleStatus = (s) => {
    const next = new Set(statusSet);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStatusSet(next);
  };

  const clear = () => { setStatusSet(new Set()); setSelectedCustomerIds([]); setSelectedAssigneeIds([]); };

  const toggleCustomer = (id) => {
    if (selectedCustomerIds.includes(id)) setSelectedCustomerIds(selectedCustomerIds.filter(x => x !== id));
    else setSelectedCustomerIds([...selectedCustomerIds, id]);
  };
  const toggleAssignee = (id) => {
    if (selectedAssigneeIds.includes(id)) setSelectedAssigneeIds(selectedAssigneeIds.filter(x => x !== id));
    else setSelectedAssigneeIds([...selectedAssigneeIds, id]);
  };

  const apply = () => {
    onApply({ status: Array.from(statusSet), customers: selectedCustomerIds, assignees: selectedAssigneeIds });
    onDismiss();
  };

  const filteredCustomers = useMemo(() => {
    return users.filter(u => u.role === 'customer' && (custSearch.trim() === '' || ((u.name || '').toLowerCase().includes(custSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(custSearch.toLowerCase()))));
  }, [users, custSearch]);

  const filteredAssignees = useMemo(() => {
    return users.filter(u => (u.role === 'employee' || u.role === 'admin') && (assigneeSearch.trim() === '' || ((u.name || '').toLowerCase().includes(assigneeSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(assigneeSearch.toLowerCase()))));
  }, [users, assigneeSearch]);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        {/* Top header: title + Pulisci (clear all) + Close X */}
        <View style={styles.modalHeader}>
          <Text style={styles.title}>Filtri ordini</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Button onPress={clear}>Pulisci</Button>
            <TouchableOpacity onPress={onDismiss} accessibilityLabel="Chiudi" style={styles.closeButtonSmall}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <SectionList
          sections={[
            { title: `Clienti${selectedCustomerIds && selectedCustomerIds.length ? ` (${selectedCustomerIds.length})` : ''}`, data: custOpen ? filteredCustomers : [], key: 'clients' },
            { title: `Assegnatari${selectedAssigneeIds && selectedAssigneeIds.length ? ` (${selectedAssigneeIds.length})` : ''}`, data: assigneeOpen ? filteredAssignees : [], key: 'assignees' },
          ]}
          keyExtractor={(item, index) => String(item.id || index)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.section}>{section.title}</Text>
              <IconButton
                icon={section.key === 'clients' ? (custOpen ? 'chevron-up' : 'chevron-down') : (assigneeOpen ? 'chevron-up' : 'chevron-down')}
                size={20}
                onPress={section.key === 'clients' ? () => setCustOpen(!custOpen) : () => setAssigneeOpen(!assigneeOpen)}
                accessibilityLabel={section.key === 'clients' ? (custOpen ? 'Chiudi Clienti' : 'Apri Clienti') : (assigneeOpen ? 'Chiudi Assegnatari' : 'Apri Assegnatari')}
              />
            </View>
          )}
          renderItem={({ item, section }) => (
            <List.Item
              title={item.name}
              description={item.email}
              onPress={() => section.key === 'clients' ? toggleCustomer(item.id) : toggleAssignee(item.id)}
              right={() => (
                <Checkbox
                  status={(section.key === 'clients' ? selectedCustomerIds.includes(item.id) : selectedAssigneeIds.includes(item.id)) ? 'checked' : 'unchecked'}
                  onPress={() => section.key === 'clients' ? toggleCustomer(item.id) : toggleAssignee(item.id)}
                />
              )}
            />
          )}
          ListHeaderComponent={() => (
            <View style={styles.scrollContent}>
              <Divider style={{ marginVertical: 8 }} />
              <Text style={styles.section}>Stato</Text>
              <View style={styles.row}>
                {['draft','pending','in_progress','completed','cancelled'].map(s => (
                  <Chip key={s} mode={statusSet.has(s) ? 'flat' : 'outlined'} style={styles.chip} onPress={() => toggleStatus(s)}>
                    {STATUS_LABELS[s] || s}
                  </Chip>
                ))}
              </View>
            </View>
          )}
          renderSectionFooter={({ section }) => (
            <View style={{ paddingHorizontal: 8 }}>
              {section.key === 'clients' ? (
                <>
                  <TextInput placeholder="Cerca clienti..." value={custSearch} onChangeText={setCustSearch} style={{ backgroundColor: 'transparent', marginBottom: 8 }} />
                  <View style={{ marginTop: 8 }}>
                    <Button onPress={() => {
                      if (selectedCustomerIds.includes('unassigned')) setSelectedCustomerIds(selectedCustomerIds.filter(x => x !== 'unassigned'));
                      else setSelectedCustomerIds([...selectedCustomerIds, 'unassigned']);
                    }}>{selectedCustomerIds.includes('unassigned') ? 'Rimuovi Clienti Non assegnati' : 'Includi Clienti Non assegnati'}</Button>
                  </View>
                </>
              ) : (
                <>
                  <TextInput placeholder="Cerca assegnatari..." value={assigneeSearch} onChangeText={setAssigneeSearch} style={{ backgroundColor: 'transparent', marginBottom: 8 }} />
                  <View style={{ marginTop: 8 }}>
                    <Button onPress={() => {
                      if (selectedAssigneeIds.includes('unassigned')) setSelectedAssigneeIds(selectedAssigneeIds.filter(x => x !== 'unassigned'));
                      else setSelectedAssigneeIds([...selectedAssigneeIds, 'unassigned']);
                    }}>{selectedAssigneeIds.includes('unassigned') ? 'Rimuovi Non assegnati' : 'Includi Non assegnati'}</Button>
                  </View>
                </>
              )}
            </View>
          )}
          contentContainerStyle={styles.scrollContent}
        />
        <View style={styles.actions}>
          <View style={{ flex: 1 }} />
          <Button mode="contained" onPress={apply}>Applica</Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', marginHorizontal: 16, padding: 0, borderRadius: 12, maxHeight: Dimensions.get('window').height * 0.8 },
  scrollContent: { padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  section: { marginTop: 12, marginBottom: 8, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginRight: 8, marginBottom: 8 },
  input: { backgroundColor: 'transparent', marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingBottom: 20, paddingHorizontal: 16 }
  ,
  closeButtonSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7E57C2', alignItems: 'center', justifyContent: 'center', elevation: 4, marginLeft: 8 },
  closeButtonText: { color: '#fff', fontSize: 16, lineHeight: 16 }
});
