import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { useSession } from '../../store/sessionStore';
import { audio } from '../../platform/audio';
import { Knight } from '../components/Knight';
import { Battlefield } from '../battlefield/Battlefield';
import {
  RANKS, rankFor, dayKey, dailyNumber, liveStreak, playedToday, msUntilNextDaily,
} from '../../core/progress';
import type { Difficulty } from '../../core/types';
import { FRAME } from '../sprites.generated';
import './home.css';

const ORDER: Difficulty[] = ['squire', 'knight', 'warlord'];

function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Re-renders once a second for the next-siege countdown. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The largest whole-number scale at which the knight fits the stage.
 *
 * Found on a real Galaxy M31: Android's system font size was 1.3x, the
 * WebView applied it (root font 20.8 px), the taller text squeezed the stage
 * to its 120 px minimum, and the 138 px knight overflowed into the title by
 * 20 px. Players who enlarge text must not be punished for it, so the hero
 * steps down a size instead of the text being blocked from scaling.
 * Measured before paint (layout effect), so there is no visible jump.
 */
function useFitScale(ref: React.RefObject<HTMLElement | null>, max: number, min: number): number {
  const [scale, setScale] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const h = el.getBoundingClientRect().height;
      // headroom for the plume above the helm
      let s = max;
      while (s > min && FRAME.h * s + 12 > h) s--;
      setScale(s);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max, min]);
  return scale;
}

/**
 * The keep. Everything that works without a server works for a guest: every
 * difficulty and the daily siege. What needs a server is shown honestly as
 * coming, not as "sign in to unlock" - signing in cannot unlock a mode that
 * does not exist yet.
 */
export function Home() {
  const { t } = useTranslation();
  const startRound = useGame((s) => s.startRound);
  const startDaily = useGame((s) => s.startDaily);
  const goto = useGame((s) => s.goto);
  const difficulty = useSettings((s) => s.difficulty);
  const setDifficulty = useSettings((s) => s.setDifficulty);
  const { status, name, house, localBest, xp, daily, dailyScores } = useSession();
  const now = useNow();
  const wallRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const knightScale = useFitScale(stageRef, 3, 2);

  const today = dayKey(now);
  const done = playedToday(daily, today);
  const streak = liveStreak(daily, today);
  const rank = rankFor(xp);
  const nextRank = rank.next !== null ? RANKS[rank.index + 1]!.id : null;

  const go = async (fn: () => void) => {
    await audio.unlock();
    void audio.preload();
    audio.play('charge');
    fn();
  };

  return (
    <div className="home">
      <Battlefield house={house} ground={0.42} anchor={wallRef} />

      <header className="home-bar">
        <button type="button" className="crest" onClick={() => goto('profile')} aria-label={t('profile.title')}>
          <span className={`crest-field crest-field--${house}`} />
        </button>
        <div className="home-who">
          <p className="home-name">{name}</p>
          <p className="home-rank">{t(`rank.${rank.id}`)}</p>
          <div className="home-xp" role="progressbar" aria-label={t('home.rank')}
               aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.progress * 100)}>
            <div className="home-xp-fill" style={{ width: `${rank.progress * 100}%` }} />
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={() => goto('settings')} aria-label={t('settings.title')}>
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
        <p>
          {nextRank
            ? t('home.xpToNext', { xp: (rank.next ?? 0) - xp, rank: t(`rank.${nextRank}`) })
            : t('home.xpTop')}
        </p>
      </div>

      <div className="home-stage" ref={stageRef}>
        <div className="home-wall" aria-hidden="true">
          <div className="home-feet" ref={wallRef}>
            <Knight house={house} anim="idle" scale={knightScale} />
          </div>
        </div>
      </div>

      <div className="home-modes">
        {/* The daily is first: it is the reason to open the app today. */}
        <button type="button" className={`mode mode--daily${done ? ' is-done' : ''}`}
                onClick={() => { if (!done) void go(() => startDaily()); }}
                aria-disabled={done}>
          <span className="mode-row">
            <span className="mode-name">{t('home.daily')} #{dailyNumber(today)}</span>
            {streak > 0 && (
              <span className="mode-streak"><span className="flame" aria-hidden="true" />{streak}</span>
            )}
          </span>
          {done ? (
            <>
              <span className="mode-desc">{t('home.dailyDone')} · {dailyScores[today] ?? 0}</span>
              <span className="mode-lock">{t('home.dailyNext', { time: hms(msUntilNextDaily(now)) })}</span>
            </>
          ) : (
            <>
              <span className="mode-desc">
                {streak > 0 ? t('home.dailyStreakKeep', { count: streak }) : t('home.dailyDesc')}
              </span>
              <span className="mode-cta">{t('home.dailyPlay')}</span>
            </>
          )}
        </button>

        <button type="button" className="mode mode--open" onClick={() => void go(() => startRound(difficulty))}>
          <span className="mode-row">
            <span className="mode-name">{t('welcome.start')}</span>
            {localBest > 0 && <span className="mode-best">{t('home.best', { score: localBest })}</span>}
          </span>
          <span className="mode-desc">{t(`difficulty.${difficulty}Desc`)}</span>
        </button>

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

        <button type="button" className="mode mode--ladder" onClick={() => goto('ladder')}>
          <span className="mode-row">
            <span className="mode-name">{t('ladder.title')}</span>
            <span className="mode-tag mode-tag--go">{t('ladder.open')}</span>
          </span>
          <span className="mode-desc">{t('ladder.explain')}</span>
        </button>

        <div className="mode mode--soon" aria-disabled="true">
          <span className="mode-row">
            <span className="mode-name">{t('home.duel')}</span>
            <span className="mode-tag">{t('home.duelSoon')}</span>
          </span>
          <span className="mode-desc">{t('home.duelDesc')}</span>
        </div>

        {status === 'guest' && (
          <button type="button" className="guest-hint" onClick={() => goto('profile')}>
            <span className="guest-hint-title">{t('guest.title')}</span>
            <span className="guest-hint-body">{t('guest.benefitLadder')}</span>
          </button>
        )}

        <button type="button" className="btn btn--ghost home-credits" onClick={() => goto('credits')}>
          {t('welcome.credits')}
        </button>
      </div>
    </div>
  );
}
