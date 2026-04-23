import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tillflow_theme';

const ThemeContext = createContext(null);

function readMediaPrefersDark() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
}

function readStoredPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'dark';
}

function resolveTheme(pref, prefersDark) {
  if (pref === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return pref === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readStoredPreference());
  const [prefersDark, setPrefersDark] = useState(readMediaPrefersDark);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'system') {
      return undefined;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(mq.matches);
    setPrefersDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themePreference]);

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference, prefersDark),
    [themePreference, prefersDark]
  );

  const setThemePreference = useCallback((next) => {
    if (next === 'light' || next === 'dark' || next === 'system') {
      setThemePreferenceState(next);
    }
  }, []);

  /** Pin to explicit light/dark (exits system) — opposite of what is currently shown. */
  const toggleTheme = useCallback(() => {
    setThemePreferenceState((pref) => {
      const resolved = resolveTheme(pref, readMediaPrefersDark());
      return resolved === 'light' ? 'dark' : 'light';
    });
  }, []);

  const setTheme = useCallback((next) => {
    setThemePreferenceState(next === 'light' ? 'light' : 'dark');
  }, []);

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      toggleTheme,
      theme: resolvedTheme,
      setTheme
    }),
    [themePreference, resolvedTheme, setThemePreference, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
