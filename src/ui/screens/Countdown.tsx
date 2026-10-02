import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import './countdown.css';

export function Countdown() {
  const goto = useGame((s) => s.goto);
  const [n, setN] = useState(3);

  useEffect(() => {
    if (n <= 0) { goto('playing'); return; }
    const id = setTimeout(() => setN((v) => v - 1), 800);
    return () => clearTimeout(id);
  }, [n, goto]);

  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span key={n} className="countdown-n">{n > 0 ? n : '⚔'}</span>
    </div>
  );
}
