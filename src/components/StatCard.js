import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function StatCard({ title, value, color = '#7E57C2' }) {
  return (
    <Card style={[styles.card, { borderLeftColor: color, borderLeftWidth: 6 }]}> 
      <Card.Content>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    backgroundColor: '#fff'
  },
  title: { fontSize: 12, color: '#666' },
  value: { fontSize: 20, fontWeight: '700', marginTop: 6 }
});
