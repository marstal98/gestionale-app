import { Platform } from "react-native";

// If you want to test on a physical device in the LAN, set LAN_IP to your machine IP.
// NOTE: updated to the detected host IP so devices on the same LAN can reach the backend.
const LAN_IP = "192.168.1.135"; // <- updated to current host IP

// Use the correct host depending on platform:
// - Android physical device should use the LAN IP
// - Other cases can use localhost
// Gestisce il caso in cui Platform.OS sia undefined (test environment)
const host = (Platform?.OS === "android") ? LAN_IP : "localhost";

// Default to host for development (unified backend). Use LAN_IP for physical devices.
// Gestisce il caso in cui __DEV__ sia undefined (test environment)
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export const API_URL = isDev
  ? `http://${host}:4000/api` // development uses host
  : `https://your-production-api.example.com/api`;

// Durata minima (ms) dello spinner di login
export const MIN_LOGIN_SPINNER_MS = 3000;

// If you are the super admin, set your email here so the app can show the special
// SuperAdmin-only tab (e.g. requests management). Replace with your email.
export const SUPERADMIN_EMAIL = 'marcostallone.developer@gmail.com';
