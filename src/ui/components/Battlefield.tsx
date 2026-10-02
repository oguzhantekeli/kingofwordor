import './battlefield.css';

/**
 * The "warriors fighting in the distance" backdrop from the brief, as pure
 * inline SVG + CSS parallax. No GIFs, no raster: ~2 KB, scales to any screen,
 * and animation is GPU-composited transform only.
 */
export function Battlefield() {
  return (
    <div className="battlefield" aria-hidden="true">
      <svg className="bf-sky" viewBox="0 0 800 400" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1208" />
            <stop offset="55%" stopColor="#4a2c12" />
            <stop offset="100%" stopColor="#7a4a1c" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.95" r="0.6">
            <stop offset="0%" stopColor="#c9762b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c9762b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="400" fill="url(#sky)" />
        <ellipse cx="400" cy="400" rx="420" ry="150" fill="url(#glow)" />
      </svg>

      <svg className="bf-layer bf-far" viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice">
        <path d="M0 200 L0 120 L60 70 L110 118 L170 55 L230 115 L300 80 L360 125 L430 60 L500 120 L560 90 L640 130 L700 85 L760 125 L800 100 L800 200 Z" fill="#20150a" />
      </svg>

      <svg className="bf-layer bf-mid" viewBox="0 0 800 160" preserveAspectRatio="xMidYMax slice">
        <g fill="#160e06">
          <rect x="120" y="60" width="26" height="100" />
          <path d="M133 30 l0 34 l40 -12 z" fill="#5a1f1f" />
          <rect x="620" y="52" width="26" height="108" />
          <path d="M633 22 l0 34 l40 -12 z" fill="#3a2a5a" />
          <path d="M0 160 L0 110 L80 95 L200 112 L340 88 L470 108 L600 86 L720 110 L800 96 L800 160 Z" />
        </g>
      </svg>

      {/* Distant warriors: silhouettes that sway, never individually animated */}
      <svg className="bf-layer bf-host" viewBox="0 0 800 90" preserveAspectRatio="xMidYMax slice">
        <g fill="#0d0804">
          {Array.from({ length: 34 }, (_, i) => {
            const x = 8 + i * 23.5 + ((i * 37) % 11);
            const h = 26 + ((i * 17) % 9);
            return (
              <g key={i} transform={`translate(${x} ${90 - h})`}>
                <rect x="0" y="6" width="5" height={h - 6} />
                <circle cx="2.5" cy="3" r="3" />
                <rect x="6" y="-6" width="1.6" height={h + 6} />
              </g>
            );
          })}
        </g>
      </svg>

      <div className="bf-smoke" />
    </div>
  );
}
