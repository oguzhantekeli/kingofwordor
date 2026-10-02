import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { audio } from '../../platform/audio';
import { tap } from '../../platform/haptics';
import { Keyboard } from '../components/Keyboard';
import { formatTime, useCountdown } from '../components/Timer';
import './play.css';

const MAX_LEN = 15;

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

  const [word, setWord] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = useCountdown(endsAt, endRound);
  const minLen = round?.config.minWordLength ?? 3;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = useCallback(() => {
    const value = word.trim();
    if (value.length === 0) return;
    const result = submit(value);
    setWord('');
    if (result?.accepted) {
      audio.play('correct');
      if (haptics) void tap('medium');
    } else {
      audio.play('wrong');
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

      <button type="button" className="btn btn--ghost btn--danger play-quit"
              onClick={() => setConfirming(true)}>
        {t('round.giveUp')}
      </button>

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('confirm.giveUp')}>
          <div className="modal-card">
            <p>{t('confirm.giveUp')}</p>
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
