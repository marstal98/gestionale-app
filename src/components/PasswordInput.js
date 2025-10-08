import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, IconButton, HelperText } from 'react-native-paper';

// Minimal modern eye icon toggle for password fields
function PasswordInput({ value, onChangeText, label, style, placeholder, autoComplete, testID, required = false, showError = false, onBlur }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[showError ? styles.errorWrapper : null]}>
      <TextInput
        label={required ? `${label} *` : label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        mode="outlined"
        style={[styles.input, style]}
        right={
          <TextInput.Icon
            // render a minimal IconButton to get a modern small eye without background
            icon={() => (
              <IconButton
                icon={visible ? 'eye-off' : 'eye'}
                size={20}
                iconColor="#444"
                containerColor="transparent"
                onPress={() => setVisible(v => !v)}
                style={styles.iconButton}
              />
            )}
            forceTextInputFocus={false}
          />
        }
        placeholder={placeholder}
        autoComplete={autoComplete}
        testID={testID}
        onBlur={onBlur}
      />
  {showError ? <HelperText type="error">Campo {label} obbligatorio</HelperText> : null}
    </View>
  );
}

export { PasswordInput };
export default PasswordInput;

const styles = StyleSheet.create({
  input: { marginBottom: 12 },
  iconButton: { margin: 0, padding: 0 },
});
