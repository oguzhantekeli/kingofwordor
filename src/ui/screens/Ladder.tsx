import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { dayKey } from '../../core/progress';
import { PROFILES } from '../../core/lang';
import { useSettings } from '../../store/settingsStore';
import {
  fetchLeaderboard, isConfigured, type LadderRow, type Period,
} from '../../platform/supabase';
import './ladder.css';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];

type State =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'rows'; rows: LadderRow[] };

/**
 * The four ladders from the brief - day, week, month, year - ranked by the
 * daily siege, so every row played the same prompts. Until the server exists
 * this says so plainly instead of showing an empty board that looks broken.
 */
export function Ladder() {
  const { t } = useTranslation();
  const goto = useGame((s) => s.goto);
  const [period, setPeriod] = useState<Period>('day');
  // one ladder per language: scores from different dictionaries never meet
  const lang = useSettings((s) => s.language);
  const [state, setState] = useState<State>(() => (isConfigured() ? { kind: 'loading' } : { kind: 'off' }));

  useEffect(() => {
    if (!isConfigured()) return;
    let live = true;
    setState({ kind: 'loading' });
    fetchLeaderboard(period, dayKey(new Date()), 50, lang)
      .then((rows) => { if (live) setState({ kind: 'rows', rows }); })
      .catch(() => { if (live) setState({ kind: 'error' }); });
    return () => { live = false; };
  }, [period, lang]);

  return (
    <div className="ladder">
      <header className="sheet-bar">
        <button type="button" className="icon-btn" onClick={() => goto('welcome')} aria-label={t('nav.back')}>
          <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="5" y="2" width="2" height="2" fill="currentColor" />
            <rect x="3" y="4" width="2" height="2" fill="currentColor" />
            <rect x="1" y="6" width="2" height="2" fill="currentColor" />
            <rect x="3" y="8" width="2" height="2" fill="currentColor" />
            <rect x="5" y="10" width="2" height="2" fill="currentColor" />
          </svg>
        </button>
        <h2>{t('ladder.title')}</h2>
        <span className="ladder-lang" lang={PROFILES[lang].locale}>{PROFILES[lang].name}</span>
      </header>

      <div className="ladder-tabs" role="tablist" aria-label={t('ladder.title')}>
        {PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p}
                  className={`ladder-tab${period === p ? ' is-active' : ''}`}
                  onClick={() => setPeriod(p)}>
            {t(`ladder.${p}`)}
          </button>
        ))}
      </div>

      <p className="ladder-explain">{t('ladder.explain')}</p>

      <div className="panel ladder-board" role="tabpanel">
        {state.kind === 'off' && <p className="ladder-note">{t('ladder.notConfigured')}</p>}
        {state.kind === 'loading' && <p className="ladder-note">{t('ladder.loading')}</p>}
        {state.kind === 'error' && <p className="ladder-note" role="alert">{t('ladder.failed')}</p>}
        {state.kind === 'rows' && state.rows.length === 0 && <p className="ladder-note">{t('ladder.empty')}</p>}
        {state.kind === 'rows' && state.rows.length > 0 && (
          <ol className="ladder-rows">
            {state.rows.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`ladder-row${r.isMe ? ' is-me' : ''}${r.rank <= 3 ? ` is-top${r.rank}` : ''}`}>
                <span className="ladder-rank">{r.rank}</span>
                <span className={`ladder-crest crest-field--${r.house}`} aria-hidden="true" />
                <span className="ladder-name">{r.name}{r.isMe && <em> · {t('ladder.you')}</em>}</span>
                <span className="ladder-meta">{period !== 'day' && t('ladder.sieges', { count: r.sieges })}</span>
                <span className="ladder-score">{r.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
