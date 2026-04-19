import { cn } from '@/lib/utils';

type Tone = 'green' | 'amber' | 'rose' | 'sky' | 'neutral';

const STROKE: Record<Tone, string> = {
  green: 'stroke-oracle-green [--c:var(--color-oracle-green)]',
  amber: 'stroke-oracle-amber [--c:var(--color-oracle-amber)]',
  rose:  'stroke-oracle-rose  [--c:var(--color-oracle-rose)]',
  sky:   'stroke-oracle-sky   [--c:var(--color-oracle-sky)]',
  neutral: 'stroke-zinc-400 [--c:#a1a1aa]',
};

type Props = {
  /** Value between 0 and 100 */
  value: number;
  /** Pixel size (width = height) */
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Circular progress ring with slot for center content (typically a number).
 */
export function Ring({
  value, size = 80, strokeWidth = 6, tone = 'green', children, className,
}: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}
         style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="color-mix(in oklch, var(--foreground) 8%, transparent)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          className={STROKE[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
