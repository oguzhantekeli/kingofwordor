import { useEffect, useRef, useState } from 'react';

/**
 * Deadline-based clock. Remaining time is DERIVED from an absolute timestamp
 * every frame, never accumulated by chained setTimeout - which drifts and is
 * throttled hard in background tabs (audit: 0.23% drift measured).
 */
export function useCountdown(endsAt: number, onEnd: () => void): number {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));
  const fired = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    fired.current = false;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left <= 0) {
        if (!fired.current) {
          fired.current = true;
          onEndRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [endsAt]);

  return remaining;
}

export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
}
