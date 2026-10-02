import { memo, useCallback } from 'react';
import './keyboard.css';

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
] as const;

interface Props {
  onKey: (k: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

/** Every key is a real <button>: reachable by tab, Enter and Space, unlike the
    audited app's role="button" tabIndex={-1} divs. */
export const Keyboard = memo(function Keyboard({
  onKey, onBackspace, onEnter, disabled = false,
}: Props) {
  const press = useCallback((k: string) => () => onKey(k), [onKey]);
  return (
    <div className="kb" role="group" aria-label="On-screen keyboard">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {i === 2 && (
            <button type="button" className="kb-key kb-key--wide" onClick={onBackspace}
              disabled={disabled} aria-label="Backspace">⌫</button>
          )}
          {row.map((k) => (
            <button type="button" key={k} className="kb-key" onClick={press(k)}
              disabled={disabled} aria-label={k.toUpperCase()}>{k.toUpperCase()}</button>
          ))}
          {i === 2 && (
            <button type="button" className="kb-key kb-key--wide kb-key--go" onClick={onEnter}
              disabled={disabled} aria-label="Submit word">⏎</button>
          )}
        </div>
      ))}
    </div>
  );
});
