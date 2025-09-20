import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton } from 'react-native-paper';

export default function SearchInput({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.wrapper}>
      <IconButton icon="magnify" size={20} style={styles.icon} />
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        underlineColor="transparent"
        mode="flat"
      />
      <IconButton
        icon="close-circle"
        size={18}
        onPress={() => onChangeText('')}
        style={styles.clear}
        disabled={!value}
        color={!value ? '#CCC' : '#666'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 6,
    elevation: 2,
  },
  icon: { margin: 0, marginLeft: 6, color: '#666' },
  input: { flex: 1, backgroundColor: 'transparent', paddingVertical: 6 },
  clear: { margin: 0 }
});
