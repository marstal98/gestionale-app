import React from 'react';
import { View, StyleSheet } from 'react-native';

// Very small bar chart made with simple Views. Expects data: array of numbers
export default function MiniBarChart({ data = [], height = 60, color = '#7E57C2' }) {
  const max = Math.max(...data, 1);
  return (
    <View style={[styles.row, { height }]}> 
      {data.map((v, i) => (
        <View key={i} style={[styles.barContainer]}> 
          <View style={[styles.bar, { height: `${(v / max) * 100}%`, backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 6 },
  barContainer: { flex: 1, paddingHorizontal: 2 },
  bar: { width: '100%', borderRadius: 6 }
});
