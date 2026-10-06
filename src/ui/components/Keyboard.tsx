import { memo, useCallback } from 'react';
import { upper, type Lang } from '../../core/lang';
import { LAYOUTS } from './layouts';
import './keyboard.css';

interface Props {
  lang: Lang;
  onKey: (k: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

/**
 * Backspace and Enter are drawn as pixel SVGs. They used to be the characters
 * U+232B and U+23CE, which Silkscreen does not contain - verified with
 * fontTools - so they fell back to a system font and rendered as tiny, blurry
 * glyphs next to crisp pixel letters.
 */
function BackIcon() {
  return (
    <svg viewBox="0 0 14 10" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M4 1h9v8H4L1 5z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 3l4 4M10 3L6 7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function EnterIcon() {
  return (
    <svg viewBox="0 0 14 10" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M11 1v5H3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 3L2 6l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Every key is a real <button>: reachable by tab, Enter and Space. */
export const Keyboard = memo(function Keyboard({
  lang, onKey, onBackspace, onEnter, disabled = false,
}: Props) {
  const press = useCallback((k: string) => () => onKey(k), [onKey]);
  const rows = LAYOUTS[lang];
  const last = rows.length - 1;
  return (
    <div className="kb" role="group" aria-label="On-screen keyboard" lang={lang}>
      {rows.map((row, i) => (
        <div className="kb-row" key={i}>
          {i === last && (
            <button type="button" className="kb-key kb-key--wide kb-key--icon" onClick={onBackspace}
                    disabled={disabled} aria-label="Backspace"><BackIcon /></button>
          )}
          {[...row].map((k) => (
            <button type="button" key={k} className="kb-key" onClick={press(k)}
                    disabled={disabled} aria-label={upper(k, lang)}>{upper(k, lang)}</button>
          ))}
          {i === last && (
            <button type="button" className="kb-key kb-key--wide kb-key--go kb-key--icon" onClick={onEnter}
                    disabled={disabled} aria-label="Submit word"><EnterIcon /></button>
          )}
        </div>
      ))}
    </div>
  );
});
