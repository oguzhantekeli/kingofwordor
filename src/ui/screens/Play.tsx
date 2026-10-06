import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { useSession } from '../../store/sessionStore';
import { audio, music } from '../../platform/audio';
import { tap } from '../../platform/haptics';
import { Keyboard } from '../components/Keyboard';
import { Knight } from '../components/Knight';
import { formatTime, useCountdown } from '../components/Timer';
import { Battlefield } from '../battlefield/Battlefield';
import { battle } from '../battlefield/bus';
import { SKIP_PENALTY_MS } from '../../core/round';
import type { AnimName } from '../sprites.generated';
import './play.css';

const MAX_LEN = 15;
/** How long the knight holds a reaction before returning to idle. */
const REACT_MS = 520;
/** A streak of this many maxes out the battle's intensity. */
const STREAK_FULL = 8;

interface Pop { id: number; text: string; good: boolean }

export function Play() {
  const { t } = useTranslation();
  const prompt = useGame((s) => s.prompt);
  const submissions = useGame((s) => s.submissions);
  const totalScore = useGame((s) => s.totalScore);
  const endsAt = useGame((s) => s.endsAt);
  const streak = useGame((s) => s.streak);
  const submit = useGame((s) => s.submit);
  const skip = useGame((s) => s.skip);
  const endRound = useGame((s) => s.endRound);
  const round = useGame((s) => s.round);
  const mode = useGame((s) => s.mode);
  const setInputMethod = useSettings((s) => s.setInputMethod);
  const haptics = useSettings((s) => s.hapticsEnabled);
  const house = useSession((s) => s.house);

  const [word, setWord] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [react, setReact] = useState<AnimName>('idle');
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(0);
  const popId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const remaining = useCountdown(endsAt, endRound);
  const duration = round?.config.durationMs ?? 60_000;
  const minLen = round?.config.minWordLength ?? 3;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { music.start(); return () => music.stop(); }, []);
  useEffect(() => {
    if (react === 'idle') return;
    const id = setTimeout(() => setReact('idle'), REACT_MS);
    return () => clearTimeout(id);
  }, [react]);
  // Low-time cue: one sting at 10 s, then each of the last five seconds. The
  // warning sound shipped from the first build and was never played anywhere.
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    const sec = Math.ceil(remaining / 1000);
    if (sec === lastSec.current) return;
    lastSec.current = sec;
    if (sec === 10 || (sec >= 1 && sec <= 5)) audio.play('warning');
  }, [remaining]);

  // the battle heats up with the streak
  useEffect(() => { battle.intensity(0.3 + Math.min(1, streak / STREAK_FULL) * 0.7); }, [streak]);

  const pop = useCallback((text: string, good: boolean) => {
    const id = ++popId.current;
    setPops((p) => [...p.slice(-3), { id, text, good }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  }, []);

  const send = useCallback(() => {
    const value = word.trim();
    if (value.length === 0) return;
    const result = submit(value);
    setWord('');
    if (!result) return;
    if (result.accepted) {
      audio.play('correct');
      setReact('strike');
      battle.win();
      pop(`+${result.points}`, true);
      if (haptics) void tap('medium');
    } else {
      audio.play('wrong');
      setReact('hurt');
      battle.loss();
      pop(t(`reject.${result.reason ?? 'notAWord'}`), false);
      setShake((n) => n + 1);
      if (haptics) void tap('light');
    }
    inputRef.current?.focus();
  }, [word, submit, haptics, pop, t]);

  const onSkip = useCallback(() => {
    skip();
    setWord('');
    pop(`${t('round.skip')} ${t('round.skipCost')}`, false);
    inputRef.current?.focus();
  }, [skip, pop, t]);

  const onKey = useCallback((k: string) => {
    setInputMethod('touch');
    setWord((w) => (w.length >= MAX_LEN ? w : w + k));
    audio.play('hit');
  }, [setInputMethod]);
  const onBackspace = useCallback(() => setWord((w) => w.slice(0, -1)), []);

  const urgent = remaining <= 10_000;
  const words = submissions.filter((s) => s.accepted).length;
  const fuse = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const ready = word.trim().length >= minLen;

  return (
    <div className="play">
      <Battlefield house={house} ground={0.4} anchor={stageRef} />

      <div className="fuse" aria-hidden="true">
        <div className={`fuse-burn${urgent ? ' is-urgent' : ''}`} style={{ width: `${fuse}%` }} />
      </div>

      <header className="play-hud">
        <button type="button" className="hud-quit" onClick={() => setConfirming(true)}
                aria-label={t('round.giveUp')}>
          <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="2" y="1" width="1" height="8" fill="currentColor" />
            <rect x="3" y="1" width="5" height="1" fill="currentColor" />
            <rect x="3" y="2" width="4" height="1" fill="currentColor" />
            <rect x="3" y="3" width="5" height="1" fill="currentColor" />
          </svg>
        </button>
        <div className="hud-score">
          <span className="hud-label">{mode === 'daily' ? t('home.daily') : t('round.score')}</span>
          <span className="hud-value">{totalScore}</span>
        </div>
        <div className={`hud-timer${urgent ? ' is-urgent' : ''}`} role="timer" aria-live="off">
          <span className="hud-value">{formatTime(remaining)}</span>
        </div>
        <div className="hud-words">
          <span className="hud-label">{t('results.words')}</span>
          <span className="hud-value">{words}</span>
        </div>
      </header>

      <div className="play-stage" ref={stageRef}>
        {streak >= 2 && (
          <p className="streak" aria-live="polite">
            <span className="streak-flame" aria-hidden="true" />
            {t('round.streak', { count: streak })}
          </p>
        )}
        {/* Damage numbers rise from the hero into the empty sky. In the word
            box they covered the next word the player was already typing. */}
        <div className="pops" aria-hidden="true">
          {pops.map((p, i) => (
            <span key={p.id} className={`pop${p.good ? ' is-good' : ' is-bad'}`}
                  style={{ marginLeft: `${(i % 2 ? 1 : -1) * Math.min(i, 2) * 18}px` }}>{p.text}</span>
          ))}
        </div>
        <Knight house={house} anim={react} scale={2} />
      </div>

      <section className="rule" role="status" aria-live="polite" aria-atomic="true">
        {prompt && (
          <>
            <div className="rule-main">
              <span className="rule-cond">{t(`round.${prompt.condition}`)}</span>
              <span className="rule-letter">{prompt.letter.toUpperCase()}</span>
            </div>
            <div className="rule-meta">
              <span className="rule-count">{t('round.possible', { count: prompt.everydayCount })}</span>
              {prompt.category && (
                <span className="rule-bonus">
                  <span className="rule-bonus-tag">{t('round.bonus')}</span>
                  {t(`category.${prompt.category}`)}
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <form className={`word${shake ? ' is-shaking' : ''}`} key={shake}
            onSubmit={(e) => { e.preventDefault(); send(); }}>
        {/* The real input: keeps hardware typing and screen readers working.
            Visually it is the tile row below. inputMode="none" stops Android
            raising its IME on top of the game's own keyboard. */}
        <input
          ref={inputRef}
          className="word-input"
          value={word}
          onChange={(e) => {
            setInputMethod('keyboard');
            setWord(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, MAX_LEN).toLowerCase());
          }}
          aria-label={t('round.placeholder')}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          enterKeyHint="send" inputMode="none"
        />
        <div className={`word-tiles${ready ? ' is-ready' : ''}`} aria-hidden="true"
             onClick={() => inputRef.current?.focus()}>
          {word.length === 0
            ? <span className="word-placeholder">{t('round.placeholder')}</span>
            : [...word].map((ch, i) => <span key={i} className="tile">{ch.toUpperCase()}</span>)}
          <span className="word-caret" />
        </div>
      </form>

      <ul className="played" aria-label={t('results.words')}>
        {submissions.filter((s) => s.reason !== 'skipped').slice(-8).reverse().map((s, i) => (
          <li key={`${s.word}-${s.at}-${i}`} className={s.accepted ? 'is-good' : 'is-bad'}>
            {s.word}{s.accepted && <b>{s.points}</b>}
          </li>
        ))}
      </ul>

      <div className="play-actions">
        <button type="button" className="btn btn--ghost skip" onClick={onSkip}
                disabled={remaining <= SKIP_PENALTY_MS}>
          {t('round.skip')} <span className="skip-cost">{t('round.skipCost')}</span>
        </button>
      </div>

      <Keyboard onKey={onKey} onBackspace={onBackspace} onEnter={send} />

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('confirm.giveUp')}>
          <div className="panel modal-card">
            <p className="modal-text">{t('confirm.giveUp')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn--danger" onClick={endRound}>{t('confirm.yes')}</button>
              <button type="button" className="btn btn--primary" onClick={() => setConfirming(false)}>{t('confirm.no')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
