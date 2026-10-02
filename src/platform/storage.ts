import { Capacitor } from '@capacitor/core';

/**
 * Preferences on device, localStorage on the web. Every accessor is guarded -
 * storage throws in private mode and returns empty after a data clear.
 */
export async function get(key: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      return (await Preferences.get({ key })).value;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function set(key: string, value: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // Non-fatal: settings are conveniences, not state of record.
  }
}
