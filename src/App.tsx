import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n'; // must initialise before the first render reads a translation
import { loadGameData } from './core/load';
import { useGame } from './store/gameStore';
import { useSettings } from './store/settingsStore';
import { audio } from './platform/audio';
import { Battlefield } from './ui/components/Battlefield';
import { Welcome } from './ui/screens/Welcome';
import { Countdown } from './ui/screens/Countdown';
import { Play } from './ui/screens/Play';
import { Results } from './ui/screens/Results';
import { Credits } from './ui/screens/Credits';

export default function App() {
  const { t } = useTranslation();
  const screen = useGame((s) => s.screen);
  const loadError = useGame((s) => s.loadError);
  const setData = useGame((s) => s.setData);
  const setLoadError = useGame((s) => s.setLoadError);
  const soundEnabled = useSettings((s) => s.soundEnabled);

  useEffect(() => { audio.setEnabled(soundEnabled); }, [soundEnabled]);

  useEffect(() => {
    let cancelled = false;
    loadGameData(`${import.meta.env.BASE_URL}dict/en.kowd`)
      .then((data) => { if (!cancelled) setData(data); })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelled = true; };
  }, [setData, setLoadError]);

  return (
    <>
      <Battlefield />
      <div className="app">
        {screen === 'loading' && <p className="boot">{t('loading.dictionary')}</p>}
        {screen === 'error' && (
          <div className="boot">
            <p>{t('loading.failed')}</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>{loadError}</p>
          </div>
        )}
        {screen === 'welcome' && <Welcome />}
        {screen === 'countdown' && <Countdown />}
        {screen === 'playing' && <Play />}
        {screen === 'results' && <Results />}
        {screen === 'credits' && <Credits />}
      </div>
    </>
  );
}
