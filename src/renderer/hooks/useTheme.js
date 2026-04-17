import { useState, useEffect, useCallback, useRef } from 'react';

export const THEMES = [
  { id: 'dark',       label: 'Dark',       icon: 'D' },
  { id: 'light',      label: 'Light',      icon: 'L' },
  { id: 'cyberpunk',  label: 'Cyberpunk',  icon: 'C' },
  { id: 'solarized',  label: 'Solarized',  icon: 'S' },
  { id: 'dracula',    label: 'Dracula',    icon: 'V' },
];

const THEME_KEY = '__theme__';
const DEFAULT_THEME = 'dark';
const VALID_IDS = THEMES.map((t) => t.id);

export default function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.boxterAPI?.session.load(THEME_KEY);
        if (saved && VALID_IDS.includes(saved.name)) {
          setThemeState(saved.name);
        }
      } catch { /* ignore */ }
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (!hydrated.current) return;
    window.boxterAPI?.session.save(THEME_KEY, { name: theme }).catch(() => {});
  }, [theme]);

  const setTheme = useCallback((id) => {
    if (VALID_IDS.includes(id)) setThemeState(id);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((cur) => {
      const idx = VALID_IDS.indexOf(cur);
      return VALID_IDS[(idx + 1) % VALID_IDS.length];
    });
  }, []);

  return { theme, setTheme, cycleTheme, themes: THEMES };
}
