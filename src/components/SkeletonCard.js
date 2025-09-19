import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function SkeletonCard({ height = 80, style }) {
  return (
    <View style={[styles.card, { height }, style]} />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#eee',
    borderRadius: 12,
    marginBottom: 12,
  }
});
