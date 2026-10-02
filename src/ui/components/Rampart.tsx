import type { ReactNode } from 'react';
import './rampart.css';

/**
 * The night keep behind the home screen.
 *
 * Pure inline SVG on the pixel grid - no raster, ~1 KB, and it scales to any
 * phone without a second asset. `shapeRendering="crispEdges"` is what keeps it
 * reading as pixel art rather than as a blurred vector when it is scaled up.
 *
 * The sky keeps its aspect ratio and the ground fills whatever is left, so the
 * wall's top edge is a real box edge rather than a number that has to be
 * guessed from the viewport width. Anything passed as a child is planted on
 * that edge, which is how the knight stands on the wall at every screen size.
 */
export function Rampart({ children }: { children?: ReactNode }) {
  return (
    <div className="rampart" aria-hidden="true">
      <div className="rampart-sky">
        <svg viewBox="0 0 130 92" shapeRendering="crispEdges" preserveAspectRatio="xMidYMax meet">
          <rect width="130" height="92" fill="#2a1b3f" />
          <rect width="130" height="40" fill="#1e1430" />

          {/* The moon rises behind the ridge on the left. Every higher
              position collided with something: the top strip is the player's
              name and the settings button, the middle is the title. It is
              drawn before the hills, so the ridge cuts across it. */}
          <rect x="16" y="52" width="10" height="10" fill="#f3d9a4" />
          <rect x="14" y="54" width="14" height="6" fill="#f3d9a4" />

          {/* placed, not random, so the sky is the same on every launch */}
          <rect x="46" y="26" width="2" height="2" fill="#f2e4c6" />
          <rect x="70" y="22" width="2" height="2" fill="#f2e4c6" />
          <rect x="88" y="32" width="2" height="2" fill="#c9a66b" />
          <rect x="112" y="24" width="2" height="2" fill="#f2e4c6" />

          <path d="M0 66 H16 V60 H34 V54 H50 V62 H72 V50 H90 V58 H108 V52 H130 V92 H0 Z" fill="#3a2440" />

          {/* the keep */}
          <rect x="52" y="32" width="10" height="34" fill="#1c1410" />
          <rect x="50" y="28" width="14" height="4" fill="#1c1410" />
          <rect x="54" y="24" width="2" height="4" fill="#9b2c2c" />
          <rect x="56" y="24" width="6" height="3" fill="#9b2c2c" />
          <rect x="68" y="42" width="18" height="24" fill="#1c1410" />
          <rect x="34" y="38" width="10" height="28" fill="#1c1410" />
          <rect x="32" y="34" width="14" height="4" fill="#1c1410" />
          <rect x="48" y="46" width="2" height="2" fill="#e07a2b" />
          <rect x="76" y="50" width="2" height="2" fill="#e07a2b" />

          {/* the wall, ending flush with the bottom of the sky box */}
          <rect y="82" width="130" height="10" fill="#241a14" />
          <rect y="82" width="130" height="2" fill="#3a2a1e" />

          {/* A scrim over the sky. Without it the moon and the keep sit behind
              the player's name and the title, and neither can be read. */}
          <defs>
            <linearGradient id="kow-scrim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#140f0a" stopOpacity="0.76" />
              <stop offset="26%" stopColor="#140f0a" stopOpacity="0.30" />
              <stop offset="52%" stopColor="#140f0a" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#140f0a" stopOpacity="0.50" />
            </linearGradient>
          </defs>
          <rect width="130" height="82" fill="url(#kow-scrim)" />
        </svg>

        {children && <div className="rampart-cast">{children}</div>}
      </div>

      <div className="rampart-ground">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="rampart-tooth" style={{ left: `${i * 32 + 4}px` }} />
        ))}
      </div>
    </div>
  );
}
