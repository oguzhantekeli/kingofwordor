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
import type { AnimName } from '../sprites.generated';
import './play.css';

const MAX_LEN = 15;
/** How long the knight holds a reaction before returning to idle. */
const REACT_MS = 520;

export function Play() {
  const { t } = useTranslation();
  const prompt = useGame((s) => s.prompt);
  const submissions = useGame((s) => s.submissions);
  const totalScore = useGame((s) => s.totalScore);
  const endsAt = useGame((s) => s.endsAt);
  const lastResult = useGame((s) => s.lastResult);
  const submit = useGame((s) => s.submit);
  const endRound = useGame((s) => s.endRound);
  const round = useGame((s) => s.round);
  const setInputMethod = useSettings((s) => s.setInputMethod);
  const haptics = useSettings((s) => s.hapticsEnabled);
  const house = useSession((s) => s.house);

  const [word, setWord] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [react, setReact] = useState<AnimName>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = useCountdown(endsAt, endRound);
  const minLen = round?.config.minWordLength ?? 3;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // The theme plays for the round and stops with it; the gesture that started
  // the round is what makes playback permissible.
  useEffect(() => {
    music.start();
    return () => music.stop();
  }, []);

  // The reaction is a timed window, not a one-shot animation: the sheet loops,
  // and a loop that is cut short reads as a flinch, which is what we want.
  useEffect(() => {
    if (react === 'idle') return;
    const id = setTimeout(() => setReact('idle'), REACT_MS);
    return () => clearTimeout(id);
  }, [react]);

  const send = useCallback(() => {
    const value = word.trim();
    if (value.length === 0) return;
    const result = submit(value);
    setWord('');
    if (result?.accepted) {
      audio.play('correct');
      setReact('strike');
      if (haptics) void tap('medium');
    } else {
      audio.play('wrong');
      setReact('hurt');
      if (haptics) void tap('light');
    }
    inputRef.current?.focus();
  }, [word, submit, haptics]);

  const onKey = useCallback((k: string) => {
    setInputMethod('touch');
    setWord((w) => (w.length >= MAX_LEN ? w : w + k));
    audio.play('hit');
  }, [setInputMethod]);

  const onBackspace = useCallback(() => setWord((w) => w.slice(0, -1)), []);

  const urgent = remaining <= 10_000;
  const best = submissions.filter((s) => s.accepted).length;

  return (
    <div className="play">
      <div className="fuse" aria-hidden="true">
        <div
          className="fuse-burn"
          style={{ width: `${Math.max(0, Math.min(100, (remaining / (round?.config.durationMs ?? 60_000)) * 100))}%` }}
        />
      </div>

      <header className="play-hud">
        <div className="hud-item">
          <span className="hud-label">{t('round.score')}</span>
          <span className="hud-value">{totalScore.toFixed(2)}</span>
        </div>
        <div className={`hud-item hud-timer${urgent ? ' is-urgent' : ''}`}
             role="timer" aria-live="off">
          <span className="hud-label">{t('round.timeLeft')}</span>
          <span className="hud-value">{formatTime(remaining)}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">{t('results.words')}</span>
          <span className="hud-value">{best}</span>
        </div>
      </header>

      <div className="play-stage">
        <Knight house={house} anim={react} scale={2} />
      </div>

      <section className="prompt" role="status" aria-live="polite" aria-atomic="true">
        {prompt && (
          <>
            <p className="prompt-text">
              {prompt.category
                ? t('round.categoryHint', {
                    category: t(`category.${prompt.category}`),
                    condition: t(`round.${prompt.condition}`),
                    letter: prompt.letter.toUpperCase(),
                  })
                : t('round.plainHint', {
                    condition: t(`round.${prompt.condition}`),
                    letter: prompt.letter.toUpperCase(),
                  })}
            </p>
            <p className="prompt-count">
              {t('round.possible', { count: prompt.everydayCount })}
            </p>
          </>
        )}
      </section>

      <form
        className="answer"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          ref={inputRef}
          className={`answer-input${lastResult && !lastResult.accepted ? ' is-bad' : ''}`}
          value={word}
          onChange={(e) => {
            setInputMethod('keyboard');
            setWord(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, MAX_LEN).toLowerCase());
          }}
          placeholder={t('round.placeholder')}
          aria-label={t('round.placeholder')}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          enterKeyHint="send"
          /* The game ships its own keyboard. Without this Android raises the
             system IME on top of it, covering half the board with a second
             keyboard. A hardware keyboard still types into the field. */
          inputMode="none"
        />
        <button type="submit" className="btn btn--primary answer-go"
                disabled={word.trim().length < minLen}>
          {t('round.submit')}
        </button>
      </form>

      {lastResult && (
        <p className={`feedback${lastResult.accepted ? ' is-good' : ''}`} role="status">
          {lastResult.accepted
            ? `+${lastResult.points.toFixed(2)}`
            : t(`reject.${lastResult.reason ?? 'notAWord'}`)}
        </p>
      )}

      <ul className="played" aria-label={t('results.words')}>
        {submissions.slice().reverse().slice(0, 12).map((s, i) => (
          <li key={`${s.word}-${s.at}-${i}`} className={s.accepted ? 'is-good' : 'is-bad'}>
            {s.word}
          </li>
        ))}
      </ul>

      <Keyboard onKey={onKey} onBackspace={onBackspace} onEnter={send} />

      <button type="button" className="btn btn--ghost play-quit"
              onClick={() => setConfirming(true)}>
        {t('round.giveUp')}
      </button>

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('confirm.giveUp')}>
          <div className="panel modal-card">
            <p className="modal-text">{t('confirm.giveUp')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn--danger" onClick={endRound}>
                {t('confirm.yes')}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setConfirming(false)}>
                {t('confirm.no')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
