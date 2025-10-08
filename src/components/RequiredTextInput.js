import React, { useState, useEffect, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { showToast } from '../utils/toastService';

const RequiredTextInput = forwardRef(({ label, required = false, name, value, onChangeText, onBlur, style, showError = false, helperText, onInvalid, ...rest }, ref) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    // clear error when value becomes non-empty
    if (value && value !== '') setError(false);
  }, [value]);

  useEffect(() => {
    // clear error when component unmounts (helps when navigating away if the component is unmounted)
    return () => {
      try { setError(false); } catch (e) { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    if (showError) setError(true);
  }, [showError]);

  const handleBlur = (e) => {
    if (required && (!value || value === '')) {
      setError(true);
      // show global toast (option A) and call optional onInvalid callback
      try { showToast(`Campo ${name || label} obbligatorio`, 'error'); } catch (er) { }
      try { if (onInvalid) onInvalid(name || label); } catch (e) { /* ignore */ }
    }
    if (onBlur) onBlur(e);
  }

  // show an asterisk for required fields (no literal tokens)
  const renderedLabel = required ? `${label} *` : label;

  return (
    <View style={[styles.wrapper, error ? styles.errorBorder : null, style]}>
      <TextInput
        mode="flat"
        label={renderedLabel}
        value={value}
        onChangeText={(t) => { if (error && t && t !== '') setError(false); onChangeText && onChangeText(t); }}
        onBlur={handleBlur}
        ref={ref}
        style={styles.input}
        {...rest}
      />
      {error ? <HelperText type="error">{helperText || `Campo ${name || label} obbligatorio`}</HelperText> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 6,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  errorBorder: {
    borderWidth: 1,
    borderColor: '#d32f2f',
    paddingHorizontal: 2,
    borderRadius: 6,
  },
  input: {
    backgroundColor: 'transparent',
  }
});

export default RequiredTextInput;
