import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { PROFILES, isLang } from '../../core/lang';
import './settings.css';

/**
 * The settings existed in the store from the first commit with nothing in the
 * UI able to change them: the game could not be muted from inside the game.
 * This is that screen.
 */
export function Settings() {
  const { t } = useTranslation();
  const goto = useGame((s) => s.goto);
  const { soundEnabled, musicEnabled, hapticsEnabled, language, setSoundEnabled, setMusicEnabled, setHapticsEnabled, setLanguage } =
    useSettings();
  const loading = useGame((s) => s.data === null || s.data.dict.lang !== language);

  return (
    <div className="settings">
      <header className="sheet-bar">
        <button type="button" className="icon-btn" onClick={() => goto('welcome')}
                aria-label={t('nav.back')}>
          <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="5" y="2" width="2" height="2" fill="currentColor" />
            <rect x="3" y="4" width="2" height="2" fill="currentColor" />
            <rect x="1" y="6" width="2" height="2" fill="currentColor" />
            <rect x="3" y="8" width="2" height="2" fill="currentColor" />
            <rect x="5" y="10" width="2" height="2" fill="currentColor" />
          </svg>
        </button>
        <h2>{t('settings.title')}</h2>
      </header>

      <ul className="rows panel">
        <li className="row">
          <span className="row-label">{t('settings.sound')}</span>
          <button type="button" role="switch" aria-checked={soundEnabled}
                  className={`toggle${soundEnabled ? ' is-on' : ''}`}
                  onClick={() => setSoundEnabled(!soundEnabled)}>
            <span className="toggle-knob" />
            <span className="visually-hidden">{soundEnabled ? t('settings.on') : t('settings.off')}</span>
          </button>
        </li>
        <li className="row">
          <span className="row-label">{t('settings.music')}</span>
          <button type="button" role="switch" aria-checked={musicEnabled}
                  className={`toggle${musicEnabled ? ' is-on' : ''}`}
                  onClick={() => setMusicEnabled(!musicEnabled)}>
            <span className="toggle-knob" />
            <span className="visually-hidden">{musicEnabled ? t('settings.on') : t('settings.off')}</span>
          </button>
        </li>
        <li className="row">
          <span className="row-label">{t('settings.haptics')}</span>
          <button type="button" role="switch" aria-checked={hapticsEnabled}
                  className={`toggle${hapticsEnabled ? ' is-on' : ''}`}
                  onClick={() => setHapticsEnabled(!hapticsEnabled)}>
            <span className="toggle-knob" />
            <span className="visually-hidden">{hapticsEnabled ? t('settings.on') : t('settings.off')}</span>
          </button>
        </li>
        <li className="row row--stack">
          <div className="row-line">
            <label className="row-label" htmlFor="lang">{t('settings.language')}</label>
            {/* each language in its own name: a player who cannot read the
                current one must still be able to find theirs */}
            <select id="lang" className="row-select" value={language}
                    onChange={(e) => { if (isLang(e.target.value)) setLanguage(e.target.value); }}>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l} value={l} lang={PROFILES[l].locale}>{PROFILES[l].name}</option>
              ))}
            </select>
          </div>
          <p className="row-hint" role="status">
            {loading ? t('loading.dictionary') : t('settings.languageHint')}
          </p>
        </li>
      </ul>
    </div>
  );
}
