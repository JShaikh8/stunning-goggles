import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'green' | 'amber' | 'rose' | 'sky' | 'violet';

const TONE: Record<Tone, string> = {
  neutral: 'text-zinc-100',
  green: 'text-oracle-green',
  amber: 'text-oracle-amber',
  rose: 'text-oracle-rose',
  sky: 'text-oracle-sky',
  violet: 'text-oracle-violet',
};

type Props = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * Standard metric display: small label (tracked uppercase), then the
 * value in a chunkier size, optional hint underneath.
 */
export function MetricTile({
  label, value, hint, tone = 'neutral', size = 'md', className,
}: Props) {
  const valueClass =
    size === 'sm' ? 'text-lg font-semibold' :
    size === 'lg' ? 'text-3xl font-semibold' :
                    'text-2xl font-semibold';
  return (
    <div
      className={cn(
        'rounded-lg border border-hairline bg-[var(--surface-1)] p-4',
        className,
      )}
    >
      <div className="h-section">{label}</div>
      <div className={cn('mt-1 font-mono tracking-tight', valueClass, TONE[tone])}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{hint}</div>
      )}
    </div>
  );
}
