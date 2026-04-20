type Point = { d: string; pct: number };

export function NrfiSparkline({
  points,
  tone,
  width = 92,
  height = 22,
}: {
  points: Point[];
  tone: 'green' | 'amber' | 'rose' | 'neutral';
  width?: number;
  height?: number;
}) {
  if (!points.length) return null;

  const min = Math.min(0, ...points.map((p) => p.pct));
  const max = Math.max(100, ...points.map((p) => p.pct));
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const color =
    tone === 'green'
      ? 'var(--color-oracle-green)'
      : tone === 'amber'
      ? 'var(--color-oracle-amber)'
      : tone === 'rose'
      ? 'var(--color-oracle-rose)'
      : 'var(--color-oracle-sky)';

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p.pct - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const mean = points.reduce((s, p) => s + p.pct, 0) / points.length;

  return (
    <div className="flex items-center gap-1.5">
      <svg width={width} height={height} className="shrink-0" aria-hidden>
        {/* mean line */}
        <line
          x1={0}
          y1={height - ((mean - min) / range) * height}
          x2={width}
          y2={height - ((mean - min) / range) * height}
          stroke="var(--hairline-strong)"
          strokeDasharray="1 2"
          strokeWidth={1}
        />
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const x = i * step;
          const y = height - ((p.pct - min) / range) * height;
          return (
            <circle key={i} cx={x} cy={y} r={1.4} fill={color} />
          );
        })}
      </svg>
      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
        μ {mean.toFixed(0)}%
      </span>
    </div>
  );
}
