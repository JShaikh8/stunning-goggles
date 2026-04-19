import { cn } from '@/lib/utils';

/**
 * Batting-/pitching-hand badge: `R` (right) | `L` (left) | `S` (switch) with
 * consistent color. Tiny, meant to sit next to a player's name.
 */
export function SideBadge({
  side,
  suffix = 'HB',
  className,
}: {
  side: string | null | undefined;
  /** 'HB' (hits) or 'HP' (pitches) */
  suffix?: 'HB' | 'HP';
  className?: string;
}) {
  if (!side) return null;
  const color =
    side === 'L' ? 'text-oracle-sky bg-oracle-sky/10' :
    side === 'R' ? 'text-oracle-amber bg-oracle-amber/10' :
                   'text-oracle-violet bg-oracle-violet/10';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-widest',
        color,
        className,
      )}
    >
      {side}{suffix}
    </span>
  );
}
