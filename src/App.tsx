import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyLanguage } from './i18n'; // must initialise before the first render reads a translation
import { loadGameData } from './core/load';
import { useGame } from './store/gameStore';
import { useSettings } from './store/settingsStore';
import { audio } from './platform/audio';
import { armSplashFailsafe, hideSplash } from './platform/splash';
import { Home } from './ui/screens/Home';
import { Countdown } from './ui/screens/Countdown';
import { Play } from './ui/screens/Play';
import { Results } from './ui/screens/Results';
import { Credits } from './ui/screens/Credits';
import { Settings } from './ui/screens/Settings';
import { Profile } from './ui/screens/Profile';
import { Ladder } from './ui/screens/Ladder';

export default function App() {
  const { t } = useTranslation();
  const screen = useGame((s) => s.screen);
  const loadError = useGame((s) => s.loadError);
  const setData = useGame((s) => s.setData);
  const setLoadError = useGame((s) => s.setLoadError);
  const unload = useGame((s) => s.unload);
  const language = useSettings((s) => s.language);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const musicEnabled = useSettings((s) => s.musicEnabled);

  useEffect(() => { audio.setEnabled(soundEnabled); }, [soundEnabled]);
  useEffect(() => { audio.setMusicEnabled(musicEnabled); }, [musicEnabled]);

  // One dictionary per language: loaded at boot, and again whenever the player
  // picks another language. The old one is dropped first, so no round can
  // start against the wrong words while the new file loads.
  const booted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    applyLanguage(language);
    const first = !booted.current;
    booted.current = true;
    if (first) armSplashFailsafe();
    else unload();
    loadGameData(`${import.meta.env.BASE_URL}dict/${language}.kowd`)
      .then((data) => { if (!cancelled) setData(data); })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      })
      // Either way there is now something worth looking at underneath.
      .finally(() => { if (first) hideSplash(); });
    return () => { cancelled = true; };
  }, [language, setData, setLoadError, unload]);

  return (
    <div className="app">
      {screen === 'loading' && <p className="boot">{t('loading.dictionary')}</p>}
      {screen === 'error' && (
        <div className="boot">
          <p>{t('loading.failed')}</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>{loadError}</p>
        </div>
      )}
      {screen === 'welcome' && <Home />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'playing' && <Play />}
      {screen === 'results' && <Results />}
      {screen === 'credits' && <Credits />}
      {screen === 'settings' && <Settings />}
      {screen === 'profile' && <Profile />}
      {screen === 'ladder' && <Ladder />}
    </div>
  );
}
