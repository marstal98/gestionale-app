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
          // schedule timers for an existing token so refresh happens silently
          try {
            scheduleTimers(storedToken, JSON.parse(storedUser), storedRefresh);
          } catch (e) {
            console.warn('Could not schedule timers on startup', e);
          }
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
    // schedule timers for token expiry/refresh
    try {
      scheduleTimers(data.token, data.user, data.refreshToken);
    } catch (e) {
      console.warn('Could not schedule timers on login', e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem('refreshToken');
    } catch (e) {
      console.error("Errore durante il logout", e);
    } finally {
      if (logoutTimerId) {
        clearTimeout(logoutTimerId);
        setLogoutTimerId(null);
      }
      if (refreshTimerId) {
        clearTimeout(refreshTimerId);
        setRefreshTimerId(null);
      }
      setRefreshToken(null);
      setToken(null);
      setUser(null);
    }
  };

  // helper to schedule logout and refresh timers based on token expiry
  const scheduleTimers = (jwtToken, userObj, refreshTok) => {
    // clear existing timers
    if (logoutTimerId) {
      clearTimeout(logoutTimerId);
      setLogoutTimerId(null);
    }
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      setRefreshTimerId(null);
    }

    try {
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (!payload || !payload.exp) return;
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const msLeft = expiresAt - now;
      if (msLeft <= 0) {
        // token already expired
        logout();
        return;
      }
      // schedule auto-logout as backup
      const id = setTimeout(() => {
        logout();
      }, msLeft + 500);
      setLogoutTimerId(id);

      // schedule refresh 60s before expiry if we have a refresh token
      if (refreshTok) {
        const refreshMs = msLeft - 60000;
        if (refreshMs > 0) {
          const rid = setTimeout(async () => {
            try {
              const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refreshTok })
              });
              if (res.ok) {
                const d = await res.json();
                if (d.token) {
                  // update token and reschedule
                  setToken(d.token);
                  await AsyncStorage.setItem('token', d.token);
                  scheduleTimers(d.token, userObj, refreshTok);
                } else {
                  logout();
                }
              } else {
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
    } catch (e) {
      console.warn('Could not parse token for expiry', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, authProcessing, setAuthProcessing }}>
      {children}
    </AuthContext.Provider>
  );
};
