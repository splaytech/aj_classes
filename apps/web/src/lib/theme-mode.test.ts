import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/constants';

import { readThemeMode, resolveTheme, saveThemeMode, toggledMode } from './theme-mode';

describe('theme mode (R3b story FS4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('remembers the choice on this device', () => {
    expect(saveThemeMode('dark')).toBe(true);
    expect(readThemeMode()).toBe('dark');
  });

  it('follows the device until a choice is made', () => {
    expect(readThemeMode()).toBe('system');
  });

  it('ignores a saved value it does not know', () => {
    window.localStorage.setItem(STORAGE_KEYS.themeMode, 'purple');
    expect(readThemeMode()).toBe('system');
  });

  it('falls back to the device setting when storage is blocked (F23)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readThemeMode()).toBe('system');
    expect(saveThemeMode('light')).toBe(false);
  });

  it.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)('%s on a device that prefers dark=%s shows %s', (mode, deviceIsDark, shown) => {
    expect(resolveTheme(mode, deviceIsDark)).toBe(shown);
  });

  it('the header button switches to the other one', () => {
    expect(toggledMode('dark')).toBe('light');
    expect(toggledMode('light')).toBe('dark');
  });
});
