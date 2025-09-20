import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, Animated } from 'react-native';
import { Modal, Portal, Text, List, IconButton, Surface, Avatar } from 'react-native-paper';
import SearchInput from './SearchInput';

export default function AssigneePicker({ visible, onDismiss, users = [], onSelect, roleFilter = null, title = 'Seleziona assegnatario' }) {
  const [query, setQuery] = useState('');
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [visible, fade]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users || [];
    if (roleFilter) {
      // roleFilter can be a string or an array of strings
      if (Array.isArray(roleFilter)) {
        const allowed = roleFilter.map(r => String(r).toLowerCase());
        list = list.filter(u => allowed.includes((u.role || '').toLowerCase()));
      } else {
        const rf = String(roleFilter).toLowerCase();
        list = list.filter(u => (u.role || '').toLowerCase() === rf);
      }
    }
    if (!q) return list;
    return list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [query, users, roleFilter]);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Animated.View style={{ opacity: fade, width: '100%', alignItems: 'center' }}>
              <Surface style={styles.surface}>
            <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
              <IconButton icon="close" onPress={onDismiss} />
            </View>
                <SearchInput placeholder="Cerca per nome o email" value={query} onChangeText={setQuery} compact={true} style={{ container: { marginVertical: 8 }, input: { paddingVertical: 8 } }} />

                <FlatList
                  data={filtered}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.list}
                  contentContainerStyle={filtered.length < 3 ? styles.listEmpty : { }}
                  renderItem={({ item }) => (
                    <List.Item
                      title={item.name}
                      description={item.email}
                      onPress={() => { onSelect(item); onDismiss(); }}
                      left={props => (
                        <Avatar.Text size={40} label={(item.name || '?').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()} />
                      )}
                    />
                  )}
                />
          </Surface>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  surface: { width: '92%', maxWidth: 560, maxHeight: '80%', padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  search: { marginTop: 10, marginBottom: 8 },
  list: { marginTop: 6 },
  listEmpty: { minHeight: 120, justifyContent: 'center' }
});
