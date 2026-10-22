// Light / dark appearance for the portal (R3b design §6.5, story FS4). The choice is kept in this
// browser only. Browser storage can be missing or blocked (private mode), so every read and write
// is guarded and the fallback is "system" (review F23).

import { STORAGE_KEYS, THEME_MODES } from '@/constants';
import type { ResolvedTheme, ThemeMode } from '@/constants';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode);
}

/** The saved choice, or "system" when there is none (or storage can't be read). */
export function readThemeMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS.themeMode);
    return isThemeMode(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** Remembers the choice on this device. Returns false when storage isn't available. */
export function saveThemeMode(mode: ThemeMode): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEYS.themeMode, mode);
    return true;
  } catch {
    return false;
  }
}

/** Light or dark, after following the device setting for "system". */
export function resolveTheme(mode: ThemeMode, deviceIsDark: boolean): ResolvedTheme {
  if (mode === 'system') return deviceIsDark ? 'dark' : 'light';
  return mode;
}

/** The header button flips whatever is showing now. */
export function toggledMode(showing: ResolvedTheme): ThemeMode {
  return showing === 'dark' ? 'light' : 'dark';
}

/** Whether the device asks for dark mode. False where the browser can't tell. */
export function deviceIsDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

/** Calls `onChange` when the device switches between light and dark. Returns a stop function. */
export function watchDeviceTheme(onChange: (isDark: boolean) => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  if (!query) return () => {};

  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
