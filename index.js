import { registerRootComponent } from 'expo';

// SOPPRESSIONE DEFINITIVA ERRORI EXPO-NOTIFICATIONS
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('expo-notifications') || 
      message.includes('removed from Expo Go') ||
      message.includes('not fully supported in Expo Go')) {
    return; // BLOCCA COMPLETAMENTE QUESTI ERRORI
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('expo-notifications') || 
      message.includes('not fully supported in Expo Go') ||
      message.includes('development build instead')) {
    return; // BLOCCA COMPLETAMENTE QUESTI WARNING
  }
  originalConsoleWarn(...args);
};

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
