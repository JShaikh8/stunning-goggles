import { cn } from '@/lib/utils';

/** Stylized team abbreviation pill. */
export function TeamBadge({
  abbrev,
  size = 'md',
  className,
}: {
  abbrev: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const s =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' :
    size === 'lg' ? 'px-3 py-1.5 text-base'   :
                    'px-2 py-1 text-xs';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md font-mono font-semibold tracking-wider uppercase',
        'bg-[var(--surface-2)] text-zinc-200 border border-hairline-strong',
        s,
        className,
      )}
    >
      {abbrev ?? '—'}
    </span>
  );
}
