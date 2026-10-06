import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSession } from '../../store/sessionStore';
import { rankFor, dailyNumber } from '../../core/progress';
import type { Submission } from '../../core/types';
import { Knight } from '../components/Knight';
import { Battlefield } from '../battlefield/Battlefield';
import { battle } from '../battlefield/bus';
import './results.css';

/** Counts up to `to` in whole steps; a stepped count reads as pixel-game. */
function useCountUp(to: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (to <= 0) { setV(0); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setV(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

/** A spoiler-free summary grid, one square per attempt. */
export function shareGrid(subs: readonly Submission[]): string {
  return subs.slice(0, 24).map((s) =>
    s.reason === 'skipped' ? '⬛' : s.accepted ? '🟩' : '🟥').join('');
}

export function Results() {
  const { t } = useTranslation();
  const totalScore = useGame((s) => s.totalScore);
  const submissions = useGame((s) => s.submissions);
  const bestStreak = useGame((s) => s.bestStreak);
  const outcome = useGame((s) => s.outcome);
  const mode = useGame((s) => s.mode);
  const day = useGame((s) => s.day);
  const again = useGame((s) => s.again);
  const goto = useGame((s) => s.goto);
  const house = useSession((s) => s.house);
  const xp = useSession((s) => s.xp);
  const posting = useGame((s) => s.posting);
  const [copied, setCopied] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const shown = useCountUp(totalScore);
  const rank = rankFor(xp);
  const accepted = useMemo(() => submissions.filter((s) => s.accepted), [submissions]);
  const best = accepted.reduce<Submission | null>((b, s) => (!b || s.points > b.points ? s : b), null);
  const rarest = accepted.reduce<Submission | null>(
    (b, s) => (!b || (s.tier ?? 0) > (b.tier ?? 0) || ((s.tier ?? 0) === (b.tier ?? 0) && s.word.length > b.word.length) ? s : b),
    null);
  const won = accepted.length > 0;
  const daily = mode === 'daily';

  // the field reflects the result: a good round leaves it roaring
  useEffect(() => { battle.intensity(won ? 0.9 : 0.2); }, [won]);

  const share = async () => {
    const head = daily
      ? `⚔️ ${t('app.title')} — ${t('results.dailyTitle', { n: dailyNumber(day) })}`
      : `⚔️ ${t('app.title')}`;
    const text = [
      head,
      `🏆 ${totalScore} · ${accepted.length} ${t('results.words').toLowerCase()} · 🔥${bestStreak}`,
      shareGrid(submissions),
    ].join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // the user cancelled the share sheet, or the clipboard was refused
    }
  };

  return (
    <div className="results">
      <Battlefield house={house} ground={0.3} intensity={won ? 0.9 : 0.2} anchor={stageRef} />

      <h2 className="results-title">
        {daily ? t('results.dailyTitle', { n: dailyNumber(day) }) : t('results.title')}
      </h2>

      <div className="results-stage" ref={stageRef}>
        <Knight house={house} anim={outcome?.newBest || outcome?.promoted ? 'cheer' : won ? 'idle' : 'hurt'} scale={3} />
      </div>

      <div className="panel results-card">
        <p className={`results-score${won ? '' : ' is-zero'}`}>{shown}</p>
        <p className="results-sub">{t('results.score')}</p>

        {outcome?.newBest && <p className="banner banner--gold">{t('results.newBest')}</p>}
        {outcome?.promoted && (
          <p className="banner banner--moss">{t('results.promoted', { rank: t(`rank.${outcome.rankAfter}`) })}</p>
        )}
        {daily && outcome && outcome.streak > 0 && (
          <p className="banner banner--fire">{t('results.streakDay', { count: outcome.streak })}</p>
        )}

        <div className="xp">
          <div className="xp-head">
            <span>{t(`rank.${rank.id}`)}</span>
            {outcome && <span className="xp-gain">{t('results.xp', { xp: outcome.xpGained })}</span>}
          </div>
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
               aria-valuenow={Math.round(rank.progress * 100)}>
            <div className="xp-fill" style={{ width: `${rank.progress * 100}%` }} />
          </div>
        </div>

        <dl className="results-stats">
          <div><dt>{t('results.words')}</dt><dd>{accepted.length}</dd></div>
          <div><dt>{t('results.bestStreak')}</dt><dd>{bestStreak}</dd></div>
          {best && <div className="wide"><dt>{t('results.best')}</dt><dd>{best.word} <b>{best.points}</b></dd></div>}
          {rarest && rarest !== best && (
            <div className="wide"><dt>{t('results.rarest')}</dt><dd>{rarest.word}</dd></div>
          )}
        </dl>

        {submissions.length > 0 && <p className="results-grid" aria-hidden="true">{shareGrid(submissions)}</p>}
        {posting !== 'idle' && (
          <p className={`results-post is-${posting}`} role="status">
            {posting === 'sending' ? t('ladder.posting') : posting === 'posted' ? t('ladder.posted') : t('ladder.postFailed')}
          </p>
        )}
      </div>

      <div className="results-actions">
        {!daily && (
          <button type="button" className="btn btn--primary" onClick={again}>{t('results.again')}</button>
        )}
        <button type="button" className="btn" onClick={() => void share()}>
          {copied ? t('results.shareCopied') : t('results.share')}
        </button>
        <button type="button" className={`btn ${daily ? 'btn--primary' : 'btn--ghost'}`} onClick={() => goto('welcome')}>
          {t('results.toKeep')}
        </button>
      </div>
    </div>
  );
}
