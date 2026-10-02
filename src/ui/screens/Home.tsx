import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { useSession } from '../../store/sessionStore';
import { audio } from '../../platform/audio';
import { Knight } from '../components/Knight';
import { Rampart } from '../components/Rampart';
import type { Difficulty } from '../../core/types';
import './home.css';

const ORDER: Difficulty[] = ['squire', 'knight', 'warlord'];

/**
 * The keep.
 *
 * A guest gets the solo run at one rank and nothing is withheld from them
 * silently: the two locked modes are visible, labelled, and say exactly what
 * unlocks them. Signing in is offered, never demanded.
 */
export function Home() {
  const { t } = useTranslation();
  const startRound = useGame((s) => s.startRound);
  const goto = useGame((s) => s.goto);
  const difficulty = useSettings((s) => s.difficulty);
  const setDifficulty = useSettings((s) => s.setDifficulty);
  const { status, name, house, localBest } = useSession();

  const guest = status === 'guest';

  const start = async () => {
    await audio.unlock();
    void audio.preload();
    audio.play('charge');
    // A guest plays one rank; choosing a rank is part of what signing in opens.
    startRound(guest ? 'knight' : difficulty);
  };

  return (
    <div className="home">
      <Rampart>
        <Knight house={house} anim="idle" scale={3} />
      </Rampart>

      <header className="home-bar">
        <button type="button" className="crest" onClick={() => goto('profile')}
                aria-label={t('profile.title')}>
          <span className={`crest-field crest-field--${house}`} />
        </button>
        <div className="home-who">
          <p className="home-name">{name}</p>
          <p className="home-best">
            {localBest > 0 ? t('home.best', { score: localBest.toFixed(1) }) : t('home.noBest')}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={() => goto('settings')}
                aria-label={t('settings.title')}>
          <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="5" y="1" width="2" height="10" fill="currentColor" />
            <rect x="1" y="5" width="10" height="2" fill="currentColor" />
            <rect x="3" y="3" width="6" height="6" fill="currentColor" />
            <rect x="4" y="4" width="4" height="4" fill="#241a14" />
          </svg>
        </button>
      </header>

      <div className="home-title">
        <h1>{t('app.title')}</h1>
        <p>{t('app.tagline')}</p>
      </div>

      <div className="home-modes">
        <button type="button" className="mode mode--open" onClick={() => void start()}>
          <span className="mode-name">{t('welcome.start')}</span>
          <span className="mode-desc">{t('home.soloDesc')}</span>
        </button>

        {!guest && (
          <fieldset className="ranks">
            <legend className="ranks-legend">{t('welcome.difficulty')}</legend>
            {ORDER.map((d) => (
              <label key={d} className={`rank${difficulty === d ? ' is-selected' : ''}`}>
                <input type="radio" name="difficulty" value={d} className="visually-hidden"
                       checked={difficulty === d} onChange={() => setDifficulty(d)} />
                {t(`difficulty.${d}`)}
              </label>
            ))}
          </fieldset>
        )}

        <div className="mode mode--locked" aria-disabled="true">
          <span className="mode-name">{t('home.daily')}</span>
          <span className="mode-desc">{t('home.dailyDesc')}</span>
          <span className="mode-lock">{t('home.locked')}</span>
        </div>

        <div className="mode mode--locked" aria-disabled="true">
          <span className="mode-name">{t('home.duel')}</span>
          <span className="mode-desc">{t('home.duelDesc')}</span>
          <span className="mode-lock">{t('home.locked')}</span>
        </div>
      </div>

      {guest && (
        <button type="button" className="guest-hint" onClick={() => goto('profile')}>
          <span className="guest-hint-title">{t('guest.title')}</span>
          <span className="guest-hint-body">{t('guest.benefitLadder')}</span>
        </button>
      )}

      <button type="button" className="btn btn--ghost home-credits" onClick={() => goto('credits')}>
        {t('welcome.credits')}
      </button>
    </div>
  );
}
