import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

export default function QuickButton({ icon, label, onPress, color = '#7E57C2' }) {
  return (
    <Button mode="contained" icon={icon} onPress={onPress} style={[styles.btn, { backgroundColor: color }]}> 
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 10,
    marginRight: 8,
    elevation: 2,
  }
});
