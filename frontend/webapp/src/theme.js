// Theme switcher (dark default, light override) — persists in localStorage.
import { useState, useEffect } from 'react';

const KEY = 'itsm_theme';
const getTheme = () => (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'dark';

export function setTheme(theme) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, theme);
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setT] = useState(getTheme());
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const change = (th) => { setTheme(th); setT(th); };
  return { theme, setTheme: change };
}
