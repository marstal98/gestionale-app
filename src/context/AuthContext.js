import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from '../config';
import { buildHeaders } from '../utils/api';
import notificationService from '../services/notificationService';

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
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          if (storedRefresh) setRefreshToken(storedRefresh);
          
          // Initialize notification service on startup
          try {
            const pushToken = await notificationService.initialize();
            if (pushToken) {
              await notificationService.registerTokenWithBackend(parsedUser.id, parsedUser.role, storedToken);
              console.log('✅ Notifiche inizializzate all\'avvio per:', parsedUser.email);
            }
          } catch (e) {
            console.warn('Could not initialize notifications on startup', e);
          }
          
          // schedule timers for an existing token so refresh happens silently
          try {
            scheduleTimers(storedToken, parsedUser, storedRefresh);
          } catch (e) {
            console.warn('Could not schedule timers on startup', e);
          }
        } else if (storedToken && !storedUser) {
          // token exists but no stored user: try to fetch current user from API
          setToken(storedToken);
          if (storedRefresh) setRefreshToken(storedRefresh);
          try {
            const fetched = await fetchCurrentUser(storedToken);
            if (fetched) {
              setUser(fetched);
              await AsyncStorage.setItem('user', JSON.stringify(fetched));
              
              // Initialize notification service
              try {
                const pushToken = await notificationService.initialize();
                if (pushToken) {
                  await notificationService.registerTokenWithBackend(fetched.id, fetched.role, storedToken);
                  console.log('✅ Notifiche inizializzate per utente recuperato:', fetched.email);
                }
              } catch (e) {
                console.warn('Could not initialize notifications for fetched user', e);
              }
              
              scheduleTimers(storedToken, fetched, storedRefresh);
            } else {
              // token invalid or server unreachable: clear token to force login
              await AsyncStorage.removeItem('token');
              setToken(null);
            }
          } catch (e) {
            console.warn('Could not fetch user on startup', e);
            // keep token but don't block startup; user will see login
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

  // DEV helper: when running in development and no stored token/user exist,
  // try to auto-login using the seeded local admin credentials. If the
  // backend is reachable and the seeded admin exists, this sets a real
  // token and user (persisted). If not, fall back to a lightweight
  // non-persisted dev user so the UI still renders; that user does NOT
  // have a token so network actions remain disabled.
  useEffect(() => {
    (async () => {
      try {
        // Only perform dev auto-login when explicitly enabled via env var.
        const allowAutoLogin = (typeof __DEV__ !== 'undefined' && __DEV__) && (process?.env?.REACT_NATIVE_DEV_AUTOLOGIN === 'true' || (typeof globalThis !== 'undefined' && globalThis.__DEV_AUTOLOGIN === true));
        if (allowAutoLogin && !token && !user) {
          try {
            const res = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'admin@local', password: 'admin123' })
            });
            if (res.ok) {
              const d = await res.json().catch(() => null);
              if (d && d.token) {
                // persist token and user like a normal login
                setToken(d.token);
                await AsyncStorage.setItem('token', d.token);
                if (d.refreshToken) {
                  setRefreshToken(d.refreshToken);
                  await AsyncStorage.setItem('refreshToken', d.refreshToken);
                }
                let userObj = d.user || null;
                if (!userObj) {
                  try {
                    const m = await fetch(`${API_URL}/auth/me`, { headers: buildHeaders(d.token) });
                    if (m.ok) userObj = await m.json().catch(() => null);
                  } catch (e) { /* ignore */ }
                }
                if (userObj) {
                  setUser(userObj);
                  await AsyncStorage.setItem('user', JSON.stringify(userObj));
                }
                try { scheduleTimers(d.token, userObj, d.refreshToken); } catch (e) { /* ignore */ }
                return;
              }
            }
          } catch (e) {
            // backend unreachable or login failed; fall back to dev user
          }
        }

        // lightweight dev-only fallback user (not persisted) — non-admin to avoid accidental privileges
        if ((typeof __DEV__ !== 'undefined' && __DEV__) && !token && !user) {
          const devUser = { id: 'dev', email: 'dev@example.local', role: 'employee', name: 'Dev' };
          setUser(devUser);
        }
      } catch (e) {
        /* ignore */
      }
    })();
  }, []);

  const login = async (data) => {
    // login payload may be partial. Accept forms like { token, user } or { token }
    const tokenToUse = data?.token || data?.accessToken || null;
    const refreshToUse = data?.refreshToken || null;
    if (!tokenToUse) throw new Error('Missing token in login payload');

  console.log('[AuthContext] login() start', { tokenProvided: !!tokenToUse, hasUserPayload: !!data?.user });
  // optimistically set token so fetchCurrentUser can use it
    setToken(tokenToUse);
    if (refreshToUse) {
      setRefreshToken(refreshToUse);
      await AsyncStorage.setItem('refreshToken', refreshToUse);
    }

    await AsyncStorage.setItem('token', tokenToUse);

    let userObj = data?.user || data?.userData || null;
    if (!userObj) {
      // try to fetch /auth/me for a full user object
      try {
        userObj = await fetchCurrentUser(tokenToUse);
      } catch (e) {
        console.warn('Could not fetch user after login', e);
      }
    }

    // Validate user has minimal shape
    if (!userObj || !userObj.email || !userObj.role) {
      // Something is wrong with the user payload — don't persist incomplete user
      // Clear token and throw so callers can handle navigation
      await AsyncStorage.removeItem('token');
      setToken(null);
      throw new Error('User data incomplete after login');
    }

    setUser(userObj);
    await AsyncStorage.setItem('user', JSON.stringify(userObj));
  console.log('[AuthContext] login() set user', { email: userObj.email, role: userObj.role });

    // Initialize notification service after login
    try {
      const pushToken = await notificationService.initialize();
      if (pushToken) {
        await notificationService.registerTokenWithBackend(userObj.id, userObj.role, tokenToUse);
        console.log('✅ Notifiche inizializzate per utente:', userObj.email);
      }
    } catch (e) {
      console.warn('Could not initialize notifications on login', e);
    }

    // schedule timers for token expiry/refresh
    try {
      scheduleTimers(tokenToUse, userObj, refreshToUse);
    } catch (e) {
      console.warn('Could not schedule timers on login', e);
    }
  };

  // fetch current user from API using an existing token
  const fetchCurrentUser = async (tokenToUse) => {
    try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: buildHeaders(tokenToUse) });
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      return d || null;
    } catch (e) {
      console.warn('fetchCurrentUser error', e);
      return null;
    }
  };

  const logout = async () => {
    try {
      // Unregister from notifications before logout
      await notificationService.unregisterFromNotifications();
      
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
      console.log('[AuthContext] logout() completed, cleared token and user');
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

    // small base64/url decoder compatible with React Native (no Buffer)
    const base64UrlDecode = (input) => {
      try {
        // convert from base64url to base64
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const atobFunc = (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') ? globalThis.atob : (typeof atob === 'function' ? atob : null);
        let binary = null;
        if (atobFunc) {
          binary = atobFunc(base64);
        } else if (typeof Buffer !== 'undefined') {
          // Node / some environments
          binary = Buffer.from(base64, 'base64').toString('binary');
        } else {
          // fallback simple decoder
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let str = '';
          let i = 0;
          base64 = base64.replace(/=+$/, '');
          for (let bc = 0, bs, buffer, idx = 0; buffer = base64.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? str += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
            buffer = chars.indexOf(buffer);
          }
          binary = str;
        }
        // decode percent-encoding to get utf8 string
        try {
          return decodeURIComponent(Array.prototype.map.call(binary, function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
        } catch (e) {
          return binary;
        }
      } catch (e) {
        return null;
      }
    };

    try {
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return;
      const decoded = base64UrlDecode(parts[1]);
      if (!decoded) return;
      const payload = JSON.parse(decoded);
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

  // if token exists but user is null (e.g. after migration or partial login), try to recover
  useEffect(() => {
    let mounted = true;
    const recover = async () => {
      if (!token || user) return;
      setLoading(true);
      try {
        const fetched = await fetchCurrentUser(token);
        if (fetched && mounted) {
          setUser(fetched);
          await AsyncStorage.setItem('user', JSON.stringify(fetched));
        }
      } catch (e) {
        console.warn('Could not recover user from token', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    recover();
    return () => { mounted = false; };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, authProcessing, setAuthProcessing }}>
      {children}
    </AuthContext.Provider>
  );
};
