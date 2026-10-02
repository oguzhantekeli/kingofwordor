import { Capacitor } from '@capacitor/core';

/** Haptics are native-only; on the web this is a no-op, never an error. */
export async function tap(style: 'light' | 'medium' = 'light'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({
      style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium,
    });
  } catch {
    // Never let feedback break gameplay.
  }
}
