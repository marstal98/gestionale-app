import { Platform } from "react-native";

// If you want to test on a physical device in the LAN, set LAN_IP to your machine IP.
const LAN_IP = "192.168.1.135"; // <- your provided IP

// Use the correct host depending on platform:
// - Android physical device should use the LAN IP
// - Other cases can use localhost
const host = Platform.OS === "android" ? LAN_IP : "localhost";

// Default to host for development (unified backend). Use LAN_IP for physical devices.
export const API_URL = __DEV__
  ? `http://${host}:4000/api` // development uses host
  : `https://your-production-api.example.com/api`;

// Durata minima (ms) dello spinner di login
export const MIN_LOGIN_SPINNER_MS = 3000;
