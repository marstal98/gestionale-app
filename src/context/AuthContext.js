import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from '../config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authProcessing, setAuthProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutTimerId, setLogoutTimerId] = useState(null);
  const [refreshTimerId, setRefreshTimerId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        const storedUser = await AsyncStorage.getItem("user");
        const storedRefresh = await AsyncStorage.getItem("refreshToken");

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedRefresh) setRefreshToken(storedRefresh);
        }
      } catch (e) {
        console.error("Errore caricamento storage", e);
      } finally {
        setLoading(false);
      }
    };

    loadStorageData();
  }, []);

  const login = async (data) => {
    setToken(data.token);
    setUser(data.user);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
    }

    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    // setup auto-logout based on token expiry
    try {
      const parts = data.token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.exp) {
          const expiresAt = payload.exp * 1000; // ms
          const now = Date.now();
          const msLeft = expiresAt - now;
          if (msLeft > 0) {
            // schedule auto-logout as backup
            if (logoutTimerId) clearTimeout(logoutTimerId);
            const id = setTimeout(() => {
              logout();
            }, msLeft + 500);
            setLogoutTimerId(id);

            // schedule token refresh 60s before expiry (if refreshToken available)
            if (data.refreshToken) {
              const refreshMs = msLeft - 60000; // 1 minute before
              if (refreshMs > 0) {
                if (refreshTimerId) clearTimeout(refreshTimerId);
                const rid = setTimeout(async () => {
                  try {
                    // call refresh endpoint
                    const res = await fetch(`${API_URL}/auth/refresh`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ refreshToken: data.refreshToken })
                    });
                    if (res.ok) {
                      const d = await res.json();
                      if (d.token) {
                        // update token in state and storage, then reschedule
                        setToken(d.token);
                        await AsyncStorage.setItem('token', d.token);
                        // recursively call login-like scheduling to set timers
                        await login({ token: d.token, user: data.user, refreshToken: data.refreshToken });
                      } else {
                        // cannot refresh -> logout
                        logout();
                      }
                    } else {
                      // refresh failed
                      logout();
                    }
                  } catch (e) {
                    console.error('Refresh token error', e);
                    logout();
                  }
                }, refreshMs);
                setRefreshTimerId(rid);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not parse token for expiry', e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
    } catch (e) {
      console.error("Errore durante il logout", e);
    } finally {
      if (logoutTimerId) {
        clearTimeout(logoutTimerId);
        setLogoutTimerId(null);
      }
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, authProcessing, setAuthProcessing }}>
      {children}
    </AuthContext.Provider>
  );
};
