import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { audio } from '../../platform/audio';
import type { Difficulty } from '../../core/types';
import './welcome.css';

const ORDER: Difficulty[] = ['squire', 'knight', 'warlord'];

export function Welcome() {
  const { t } = useTranslation();
  const startRound = useGame((s) => s.startRound);
  const goto = useGame((s) => s.goto);
  const difficulty = useSettings((s) => s.difficulty);
  const setDifficulty = useSettings((s) => s.setDifficulty);

  const start = async () => {
    await audio.unlock();
    void audio.preload();
    audio.play('charge');
    startRound(difficulty);
  };

  return (
    <div className="welcome">
      <h1 className="welcome-title">{t('app.title')}</h1>
      <p className="welcome-tagline">{t('app.tagline')}</p>

      <fieldset className="diff">
        <legend className="diff-legend">{t('welcome.difficulty')}</legend>
        {ORDER.map((d) => (
          <label key={d} className={`diff-option${difficulty === d ? ' is-selected' : ''}`}>
            <input
              type="radio" name="difficulty" value={d}
              checked={difficulty === d}
              onChange={() => setDifficulty(d)}
              className="visually-hidden"
            />
            <span className="diff-name">{t(`difficulty.${d}`)}</span>
            <span className="diff-desc">{t(`difficulty.${d}Desc`)}</span>
          </label>
        ))}
      </fieldset>

      <button type="button" className="btn btn--primary welcome-start" onClick={() => void start()}>
        {t('welcome.start')}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => goto('credits')}>
        {t('welcome.credits')}
      </button>
    </div>
  );
}
