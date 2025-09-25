import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function QuickList({ items = [], title = '' }) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{title}</Text>
        {items.map((it, idx) => (
          <View key={idx} style={styles.row}>
            <Text style={{ flex: 1 }}>{it.title}</Text>
            <Text style={{ color: it.metaColor || '#777' }}>{it.meta}</Text>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomColor: '#eee', borderBottomWidth: 1 }
});
