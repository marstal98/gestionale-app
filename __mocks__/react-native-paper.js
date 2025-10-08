// Mock for react-native-paper that provides minimal shims to avoid Platform.select errors
const React = require('react');

const TextInput = (props) => React.createElement('input', {
  ...props,
  value: props.value || '',
  onChange: e => props.onChangeText && props.onChangeText(e.target.value)
});

const HelperText = (props) => React.createElement('div', props, props.children);
const Button = (props) => React.createElement('button', { ...props, onClick: props.onPress }, props.children);
const Modal = (props) => props.visible ? React.createElement('div', props, props.children) : null;
const Portal = (props) => React.createElement('div', props, props.children);
const Provider = (props) => React.createElement('div', props, props.children);

module.exports = {
  TextInput,
  HelperText,
  Button,
  Modal,
  Portal,
  Provider,
};