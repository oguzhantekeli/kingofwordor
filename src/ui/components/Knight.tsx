import type { CSSProperties } from 'react';
import { ANIMS, COLUMNS, FRAME, type AnimName, type House } from '../sprites.generated';
import './knight.css';

interface Props {
  house: House;
  anim?: AnimName;
  /** Integer only: pixel art resampled at a fractional scale shimmers. */
  scale?: number;
  /** Face the other way, for the opponent in a duel. */
  flip?: boolean;
  label?: string;
}

/**
 * One generated knight, animated by stepping a sprite sheet.
 *
 * The sheet geometry comes from sprites.generated.ts, which the sprite build
 * writes, so adding a frame to an animation cannot silently desync the UI.
 * Timing is inline rather than in a class because CSS steps() will not take a
 * custom property.
 */
export function Knight({ house, anim = 'idle', scale = 3, flip = false, label }: Props) {
  const { row, frames, fps } = ANIMS[anim];
  const n = Math.max(1, Math.round(scale));
  const w = FRAME.w * n;
  const h = FRAME.h * n;

  const style: CSSProperties & Record<'--kow-run', string> = {
    width: `${w}px`,
    height: `${h}px`,
    backgroundImage: `url(${import.meta.env.BASE_URL}sprites/knight-${house}.png)`,
    backgroundSize: `${COLUMNS * w}px ${Object.keys(ANIMS).length * h}px`,
    backgroundPositionY: `${-row * h}px`,
    animation: `kow-run ${(frames / fps) * 1000}ms steps(${frames}) infinite`,
    transform: flip ? 'scaleX(-1)' : undefined,
    '--kow-run': `${-frames * w}px`,
  };

  return (
    <div
      className="knight"
      style={style}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
