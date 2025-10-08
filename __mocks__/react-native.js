// Global manual mock for react-native to allow jsdom-based logic & simple component tests.
// We provide minimal shims for components used in the test suite.

const React = require('react');

function View(props){ return React.createElement('div', props, props.children); }
function Text(props){ return React.createElement('span', props, props.children); }
function ScrollView(props){ return React.createElement('div', props, props.children); }
function TextInput(props){
  return React.createElement('input', {
    ...props,
    value: props.value || '',
    onChange: e => props.onChangeText && props.onChangeText(e.target.value)
  });
}
function TouchableOpacity(props){
  return React.createElement('button', { ...props, onClick: props.onPress }, props.children);
}

module.exports = {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform: { OS: 'web', select: obj => obj.web || obj.default },
  StyleSheet: { 
    create: (styles) => {
      // Return the styles object with numeric keys for each style
      const processedStyles = {};
      Object.keys(styles).forEach((key, index) => {
        processedStyles[key] = index;
      });
      return processedStyles;
    }
  },
  // Timers / helpers
  NativeModules: {},
};
