import { Capacitor } from '@capacitor/core';

/**
 * Takes the native splash screen down.
 *
 * capacitor.config.ts sets `launchAutoHide: false` on purpose - the splash
 * should stay up until the dictionary is parsed, so the first thing a player
 * sees is the keep rather than a loading line. But nothing ever called hide(),
 * so on a real device the app launched to a splash and stayed there: a black
 * screen, no crash, no log, nothing to click.
 *
 * The timeout is the other half of the fix. If the boot path ever throws before
 * reaching its call, a player must not be trapped on a splash forever - better
 * to show them the error screen underneath.
 */
const FAILSAFE_MS = 8000;

let done = false;

async function hideNow(): Promise<void> {
  if (done || !Capacitor.isNativePlatform()) return;
  done = true;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // The splash is cosmetic; failing to hide it must not break the boot.
  }
}

/** Call once the first screen is ready to be looked at. */
export function hideSplash(): void {
  void hideNow();
}

/** Armed at boot, so a failure upstream cannot leave the splash up. */
export function armSplashFailsafe(): void {
  if (!Capacitor.isNativePlatform()) return;
  setTimeout(() => void hideNow(), FAILSAFE_MS);
}
