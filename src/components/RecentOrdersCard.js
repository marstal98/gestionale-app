import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

const statusColor = (s) => {
  switch ((s||'').toString()) {
    case 'draft': return '#9E9E9E';
    case 'pending': return '#FB8C00';
    case 'in_progress': return '#1976D2';
    case 'completed': return '#2E7D32';
    case 'cancelled': return '#E53935';
    default: return '#616161';
  }
};
export default function RecentOrdersCard({ orders = [] }) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.title}>Ordini recenti</Text>
        {orders.length === 0 && <Text style={{ color: '#777' }}>Nessun ordine recente</Text>}
        {orders.map((o) => (
          <View key={o.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>#{o.id}</Text>
              <Text style={styles.meta}>{o.customer?.name || o.customer?.email || '—'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor(o.status) }]}>
              <Text style={styles.badgeText}>{(() => {
                switch ((o.status||'').toString()) {
                  case 'draft': return 'Bozza';
                  case 'pending': return 'In attesa';
                  case 'in_progress': return "In corso";
                  case 'completed': return 'Completato';
                  case 'cancelled': return 'Annullato';
                  default: return (o.status || '').toString();
                }
              })()}</Text>
            </View>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginBottom: 12, paddingBottom: 4 },
  title: { fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
  orderId: { fontWeight: '700' },
  meta: { color: '#777', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});
