import type { ParkDims } from '@/lib/park-dims';

export type SprayHit = {
  hitCoordX: number | null;
  hitCoordY: number | null;
  eventType: string | null;
};

/**
 * Top-down stadium diagram with the hitter's pull-side fence highlighted in
 * oracle-green, recent batted balls overlaid. `hits` use MLB hit-coords
 * (0,0 at top-left, home plate at ~125,200 in the native 250x250 grid).
 */
export function ParkOverlay({
  park,
  hits,
  hitterSide,
  size = 240,
  featured = false,
}: {
  park: ParkDims;
  hits: SprayHit[];
  hitterSide: string | null;
  size?: number;
  featured?: boolean;
}) {
  const cx = size / 2;
  const cy = size * 0.82;
  const scale = (size * 0.72) / 420; // 420ft max radius → canvas

  // Build wall arc from L (−45°) to R (+45°) — linear interp with a small
  // center "bump" so CF protrudes
  const wallPts: [number, number][] = [];
  for (let deg = -45; deg <= 45; deg += 2) {
    const t = (deg + 45) / 90;
    const dist = park.L + (park.R - park.L) * t;
    const centerBump = Math.sin(t * Math.PI) * (park.C - (park.L + park.R) / 2);
    const d = dist + Math.max(0, centerBump);
    const rad = ((deg - 90) * Math.PI) / 180;
    wallPts.push([cx + Math.cos(rad) * d * scale, cy + Math.sin(rad) * d * scale]);
  }
  const wallPath =
    wallPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const flLeft = [
    cx + Math.cos((-135 * Math.PI) / 180) * park.L * scale,
    cy + Math.sin((-135 * Math.PI) / 180) * park.L * scale,
  ];
  const flRight = [
    cx + Math.cos((-45 * Math.PI) / 180) * park.R * scale,
    cy + Math.sin((-45 * Math.PI) / 180) * park.R * scale,
  ];

  // Pull-side arc — half of wall on pull side
  const pullRight = hitterSide === 'L';
  const pullPts = pullRight
    ? wallPts.filter((_, i) => i >= Math.floor(wallPts.length * 0.55))
    : wallPts.filter((_, i) => i <= Math.ceil(wallPts.length * 0.45));
  const pullPath =
    pullPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const markers = [300, 400];

  // Project MLB hit coords (native grid: home plate ≈ (125,200), OF top ≈ y=0)
  // onto our canvas. MLB coords: x centered at ~125, y decreases outward. We
  // rescale so 0..250 maps to a vertical range matching the park arc.
  const projHit = (x: number, y: number) => {
    const dx = (x - 125) / 125;        // −1..+1 across foul lines
    const dy = (200 - y) / 200;        // 0 at home, 1 at 400ft wall
    const px = cx + dx * size * 0.48;
    const py = cy - dy * size * 0.66;
    return [px, py] as [number, number];
  };

  return (
    <svg width={size} height={size} className="block" aria-hidden>
      {/* background */}
      <rect x={0} y={0} width={size} height={size} fill="var(--surface-2)" opacity={0.3} />
      {/* field fill */}
      <polygon
        points={`${cx},${cy} ${flLeft[0]},${flLeft[1]} ${wallPts
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(' ')} ${flRight[0]},${flRight[1]}`}
        fill="var(--surface-1)"
      />
      {/* distance rings */}
      {markers.map((d) => {
        const pts: [number, number][] = [];
        for (let deg = -45; deg <= 45; deg += 3) {
          const rad = ((deg - 90) * Math.PI) / 180;
          pts.push([cx + Math.cos(rad) * d * scale, cy + Math.sin(rad) * d * scale]);
        }
        const p =
          pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        return (
          <path
            key={d}
            d={p}
            fill="none"
            stroke="var(--hairline)"
            strokeDasharray="2 3"
            strokeWidth={1}
          />
        );
      })}
      {markers.map((d) => (
        <text
          key={`l${d}`}
          x={cx}
          y={cy - d * scale - 2}
          fontSize={8}
          fill="color-mix(in oklch, var(--foreground) 45%, transparent)"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {d}
        </text>
      ))}
      {/* foul lines */}
      <line
        x1={cx}
        y1={cy}
        x2={flLeft[0]}
        y2={flLeft[1]}
        stroke="var(--hairline-strong)"
        strokeWidth={1}
      />
      <line
        x1={cx}
        y1={cy}
        x2={flRight[0]}
        y2={flRight[1]}
        stroke="var(--hairline-strong)"
        strokeWidth={1}
      />
      {/* infield diamond */}
      <polygon
        points={[
          [cx, cy],
          [cx + 88 * scale, cy - 88 * scale],
          [cx, cy - 126 * scale],
          [cx - 88 * scale, cy - 88 * scale],
        ]
          .map(([x, y]) => `${x},${y}`)
          .join(' ')}
        fill="var(--surface-2)"
        stroke="var(--hairline-strong)"
        strokeWidth={1}
      />
      {/* outer wall */}
      <path d={wallPath} fill="none" stroke="var(--foreground)" strokeWidth={1.4} opacity={0.6} />
      {/* pull-side fence */}
      {hitterSide && (
        <path
          d={pullPath}
          fill="none"
          stroke="var(--color-oracle-green)"
          strokeWidth={2.6}
          opacity={0.9}
          strokeLinecap="round"
        />
      )}
      {featured && hitterSide && (
        <text
          x={cx + (pullRight ? size * 0.28 : -size * 0.28)}
          y={cy - size * 0.28}
          fontSize={9}
          fontFamily="var(--font-mono)"
          fill="var(--color-oracle-green)"
          textAnchor="middle"
          fontWeight={600}
        >
          PULL · {pullRight ? park.R : park.L}ft
        </text>
      )}
      {/* hits */}
      {hits.map((h, i) => {
        if (h.hitCoordX == null || h.hitCoordY == null) return null;
        const [px, py] = projHit(h.hitCoordX, h.hitCoordY);
        const isHr = h.eventType === 'home_run';
        const isHit = h.eventType === 'single' || h.eventType === 'double' || h.eventType === 'triple';
        const col = isHr
          ? 'var(--color-oracle-amber)'
          : isHit
          ? 'var(--color-oracle-green)'
          : 'var(--color-oracle-rose)';
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={isHr ? 3.5 : 2}
            fill={col}
            opacity={isHr ? 0.95 : 0.6}
          />
        );
      })}
      {/* home plate */}
      <polygon
        points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx + 4},${cy + 3} ${cx},${cy + 6} ${cx - 4},${cy + 3}`}
        fill="var(--foreground)"
      />
    </svg>
  );
}
