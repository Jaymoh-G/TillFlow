import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, logoutRequest, meRequest } from '../api/auth';

const TOKEN_KEY = 'tillflow_sanctum_token';
const LEGACY_SESSION_TOKEN_KEY = TOKEN_KEY;

const AuthContext = createContext(null);

function readStoredToken() {
  const local = localStorage.getItem(TOKEN_KEY);
  if (local) {
    return local;
  }
  const session = sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
  if (session) {
    // One-time migration path for older session-only auth storage.
    localStorage.setItem(TOKEN_KEY, session);
    return session;
  }
  return null;
}

function writeStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  // Keep session key in sync for backward compatibility with existing tabs.
  sessionStorage.setItem(LEGACY_SESSION_TOKEN_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = readStoredToken();
      if (!stored) {
        if (!cancelled) {
          setBootstrapping(false);
        }
        return;
      }

      setToken(stored);

      try {
        const data = await meRequest(stored);
        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password, device_name }) => {
    const data = await loginRequest({
      email,
      password,
      device_name: device_name ?? 'tillflow-web',
    });
    const nextToken = data.token;
    writeStoredToken(nextToken);
    setToken(nextToken);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const current = readStoredToken();
    if (current) {
      try {
        await logoutRequest(current);
      } catch {
        // Token may already be invalid; still clear locally.
      }
    }
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = readStoredToken();
    if (!current) {
      return;
    }
    try {
      const data = await meRequest(current);
      setUser(data.user);
    } catch {
      clearStoredToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      bootstrapping,
      login,
      logout,
      refreshUser,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, bootstrapping, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Null outside TillFlow `AuthProvider` — use for screens shared with the legacy app router. */
export function useOptionalAuth() {
  return useContext(AuthContext);
}

