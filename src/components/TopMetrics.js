import React from 'react';
import { View, StyleSheet } from 'react-native';
import StatCard from './StatCard';
import { getStatusColor } from '../utils/statusColors';

export default function TopMetrics({ metrics = {} }) {
  const { users = 0, orders = 0, draft = 0, pending = 0, inProgress = 0, completed = 0 } = metrics;
  return (
    <View style={styles.grid}>
      <View style={styles.cell}><StatCard title="Utenti" value={users} color="#7E57C2"/></View>
      <View style={styles.cell}><StatCard title="Ordini" value={orders} color="#1565C0"/></View>
      <View style={styles.cell}><StatCard title="Bozze" value={draft} color={getStatusColor('draft')} /></View>
      <View style={styles.cell}><StatCard title="In attesa" value={pending} color={getStatusColor('pending')} /></View>
      <View style={styles.cell}><StatCard title="In corso" value={inProgress} color={getStatusColor('in_progress')} /></View>
      <View style={styles.cell}><StatCard title="Completati" value={completed} color={getStatusColor('completed')} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  cell: { width: '50%', paddingRight: 8, paddingLeft: 0 }
});
