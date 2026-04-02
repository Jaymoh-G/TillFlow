import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, logoutRequest, meRequest } from '../api/auth';

const TOKEN_KEY = 'tillflow_sanctum_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = sessionStorage.getItem(TOKEN_KEY);
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
          sessionStorage.removeItem(TOKEN_KEY);
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
    sessionStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const current = sessionStorage.getItem(TOKEN_KEY);
    if (current) {
      try {
        await logoutRequest(current);
      } catch {
        // Token may already be invalid; still clear locally.
      }
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      bootstrapping,
      login,
      logout,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, bootstrapping, login, logout]
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
