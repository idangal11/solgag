import type { BuildingType } from '../types';

/**
 * Stylised top-down illustration of a building and rooftop, used when a listing
 * has no uploaded photo. Clearly an illustration — not imagery of a real roof.
 */
const PALETTE: Record<BuildingType, { ground: string; roof: string; roof2: string; accent: string }> = {
  warehouse: { ground: '#dfe8dc', roof: '#b9c4c9', roof2: '#a7b3b9', accent: '#7c8b92' },
  factory: { ground: '#e4e1d6', roof: '#c2bfb5', roof2: '#aeaa9f', accent: '#8a8476' },
  dairy: { ground: '#d8e6c7', roof: '#c9b79a', roof2: '#b8a587', accent: '#8f7d5f' },
  commercial: { ground: '#e3e3e3', roof: '#cfd6dc', roof2: '#bcc5cc', accent: '#90a0ab' },
  agri: { ground: '#d5e5c4', roof: '#d4cbb8', roof2: '#c2b8a2', accent: '#9b8f75' },
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RoofArt({ type, seed, className }: { type: BuildingType; seed: string; className?: string }) {
  const p = PALETTE[type];
  const h = hash(seed);
  const rot = (h % 30) - 15;
  const long = type === 'dairy' || type === 'agri';
  const bw = long ? 250 : 190;
  const bh = long ? 70 : 120;
  const panelRows = long ? 3 : 5;
  const panelCols = long ? 14 : 9;
  const gid = `g${h}`;
  return (
    <svg className={className} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="איור להמחשה של גג">
      <defs>
        <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.ground} />
          <stop offset="1" stopColor="#f3f6f1" />
        </linearGradient>
        <pattern id={`${gid}-rib`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={p.roof} />
          <rect width="2" height="8" fill={p.roof2} />
        </pattern>
      </defs>
      <rect width="400" height="240" fill={`url(#${gid}-sky)`} />
      {/* fields / roads */}
      <path d={`M0 ${190 + (h % 20)} L400 ${170 + (h % 30)}`} stroke="#ffffff" strokeWidth="14" opacity="0.7" />
      <path d={`M${60 + (h % 80)} 0 L${40 + (h % 60)} 240`} stroke="#ffffff" strokeWidth="8" opacity="0.5" />
      {Array.from({ length: 5 }).map((_, i) => (
        <circle key={i} cx={(h * (i + 3)) % 400} cy={(h * (i + 7)) % 240} r={6 + (i % 3) * 3} fill="#9cc58b" opacity="0.7" />
      ))}
      <g transform={`translate(200 115) rotate(${rot})`}>
        <rect x={-bw / 2 + 6} y={-bh / 2 + 8} width={bw} height={bh} fill="#000" opacity="0.12" rx="2" />
        <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} fill={`url(#${gid}-rib)`} stroke={p.accent} strokeWidth="2" rx="2" />
        {/* potential panel layout, drawn semi-transparent */}
        <g opacity="0.92">
          {Array.from({ length: panelRows }).map((_, r) =>
            Array.from({ length: panelCols }).map((__, c) => {
              const pw = (bw - 30) / panelCols;
              const ph = (bh - 24) / panelRows;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={-bw / 2 + 15 + c * pw + 1}
                  y={-bh / 2 + 12 + r * ph + 1}
                  width={pw - 2}
                  height={ph - 3}
                  fill="#1d3d5c"
                  stroke="#3d6e96"
                  strokeWidth="0.8"
                  opacity={(r + c + h) % 7 === 0 ? 0 : 1}
                />
              );
            }),
          )}
        </g>
        {type === 'factory' && <rect x={bw / 2 - 40} y={-bh / 2 - 22} width="16" height="22" fill={p.accent} />}
        {type === 'commercial' && <rect x={-bw / 2 + 10} y={bh / 2 - 26} width="40" height="18" fill="#e9eef1" stroke={p.accent} />}
      </g>
      <circle cx="356" cy="36" r="18" fill="#f5b81c" opacity="0.95" />
      <circle cx="356" cy="36" r="27" fill="#f5b81c" opacity="0.18" />
    </svg>
  );
}
