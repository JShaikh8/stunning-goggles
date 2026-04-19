import { cn } from '@/lib/utils';

/**
 * Dual-value horizontal bar — compares a "projected" vs "actual" number
 * against the max of the two (or a given maxBase). Renders as a thin bar
 * with two overlapping fills.
 */
export function SparkBar({
  proj,
  actual,
  maxBase = 10,
  width = 140,
  className,
}: {
  proj: number | null | undefined;
  actual: number | null | undefined;
  maxBase?: number;
  width?: number;
  className?: string;
}) {
  const p = proj ?? 0;
  const a = actual ?? 0;
  const max = Math.max(maxBase, p, a, 1);
  return (
    <span
      className={cn('relative block h-1.5 overflow-hidden rounded bg-zinc-800', className)}
      style={{ width }}
    >
      <span
        className="absolute top-0 left-0 h-full rounded bg-zinc-500/60"
        style={{ width: `${(p / max) * 100}%` }}
      />
      <span
        className="absolute top-0 left-0 h-full rounded bg-oracle-green/80 mix-blend-lighten"
        style={{ width: `${(a / max) * 100}%` }}
      />
    </span>
  );
}
