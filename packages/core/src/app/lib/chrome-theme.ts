import { useCallback, useEffect, useState } from 'react';

export type ChromeTheme = 'dark' | 'light';

const KEY = 'open-design-frame:theme';
const ATTR = 'data-odf-theme';

/**
 * Dark or light for the viewer's own chrome.
 *
 * The frames are not affected: a frame paints itself from its own tokens, and a
 * dark design has to look the same whichever desk it is being read at. This
 * only decides what surrounds it.
 */
export function useChromeTheme(): [ChromeTheme, () => void] {
  const [theme, setTheme] = useState<ChromeTheme>('dark');

  useEffect(() => {
    // A stored preference is per-browser and may be unreadable (a private
    // window, blocked site data); dark is the answer when it cannot be read.
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    const next: ChromeTheme = stored === 'light' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute(ATTR, next);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ChromeTheme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute(ATTR, next);
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // A preference we cannot store is still a preference for this session.
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
