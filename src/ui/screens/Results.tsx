import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import './results.css';

export function Results() {
  const { t } = useTranslation();
  const totalScore = useGame((s) => s.totalScore);
  const submissions = useGame((s) => s.submissions);
  const startRound = useGame((s) => s.startRound);
  const goto = useGame((s) => s.goto);
  const difficulty = useSettings((s) => s.difficulty);

  const accepted = submissions.filter((s) => s.accepted);
  const best = accepted.reduce<(typeof accepted)[number] | null>(
    (b, s) => (b === null || s.points > b.points ? s : b),
    null
  );

  const share = async () => {
    const text = `⚔️ ${t('app.title')} — ${totalScore.toFixed(2)} (${accepted.length} words)`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
    } catch {
      // user cancelled, or no permission - nothing to recover from
    }
  };

  return (
    <div className="results">
      <h2 className="results-title">{t('results.title')}</h2>
      <p className="results-score">{totalScore.toFixed(2)}</p>
      <p className="results-sub">{t('results.score')}</p>

      <dl className="results-stats">
        <div><dt>{t('results.words')}</dt><dd>{accepted.length}</dd></div>
        {best && <div><dt>{t('results.best')}</dt><dd>{best.word} · {best.points.toFixed(2)}</dd></div>}
      </dl>

      <div className="results-actions">
        <button type="button" className="btn btn--primary" onClick={() => startRound(difficulty)}>
          {t('results.again')}
        </button>
        <button type="button" className="btn" onClick={() => void share()}>{t('results.share')}</button>
        <button type="button" className="btn btn--ghost" onClick={() => goto('welcome')}>
          {t('results.home')}
        </button>
      </div>
    </div>
  );
}
