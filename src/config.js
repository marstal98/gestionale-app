import { Platform } from "react-native";

const localhost =
  Platform.OS === "android" ? "10.0.2.2" : "localhost";

// If you want to test on a physical device in the LAN, set LAN_IP to your machine IP.
const LAN_IP = "192.168.1.135"; // change if needed

// Default to localhost for development (unified backend). Use LAN_IP for physical devices.
export const API_URL = __DEV__
  ? `http://${localhost}:4000/api` // development uses localhost
  : `https://your-production-api.example.com/api`;

// Durata minima (ms) dello spinner di login
export const MIN_LOGIN_SPINNER_MS = 3000;
