import React from 'react';
import { View, StyleSheet } from 'react-native';
import StatCard from './StatCard';

export default function TopMetrics({ metrics = {} }) {
  const { users = 0, orders = 0, inProgress = 0, completed = 0 } = metrics;
  return (
    <View style={styles.grid}>
      <View style={styles.cell}><StatCard title="Utenti" value={users} color="#7E57C2"/></View>
      <View style={styles.cell}><StatCard title="Ordini" value={orders} color="#1565C0"/></View>
      <View style={styles.cell}><StatCard title="In corso" value={inProgress} color="#FB8C00"/></View>
      <View style={styles.cell}><StatCard title="Completati" value={completed} color="#2E7D32"/></View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  cell: { width: '50%', paddingRight: 8, paddingLeft: 0 }
});
