import { cn } from '@/lib/utils';

type Props = {
  factorDk: number | null | undefined;
  factorFd?: number | null | undefined;
  tunedDk?: number | null | undefined;
  mlDk?: number | null | undefined;
  mlFd?: number | null | undefined;
  blendDk?: number | null | undefined;
  blendFd?: number | null | undefined;
  variant?: 'row' | 'block';
};

/**
 * Presents a single headline "Blend" FD projection (primary) with the
 * underlying Factor and ML numbers as small context. FD is the default
 * scoring display per user preference; DK is shown as the secondary number.
 */
export function ProjectionTriple({
  factorDk,
  factorFd,
  tunedDk,
  mlDk,
  mlFd,
  blendDk,
  blendFd,
  variant = 'row',
}: Props) {
  // Pick the headline FD value — prefer blend FD, then ml FD, then factor FD.
  const headlineFd = blendFd ?? mlFd ?? factorFd;
  const headlineDk = blendDk ?? tunedDk ?? mlDk ?? factorDk;

  const hasMl = mlDk != null && !Number.isNaN(mlDk);
  const hasFactor = factorDk != null && !Number.isNaN(factorDk);
  const delta = hasMl && hasFactor ? (mlDk as number) - (factorDk as number) : 0;
  const divergent = Math.abs(delta) >= 2;

  if (variant === 'block') {
    return (
      <div className="flex items-center gap-4">
        <HeadlineColumn fd={headlineFd} dk={headlineDk} size="lg" />
        <div className="flex flex-col items-end gap-0.5 border-l border-hairline pl-4 font-mono text-[10px] text-zinc-500">
          {hasFactor && factorFd != null && (
            <span>factor <span className="text-zinc-300">{factorFd.toFixed(1)}</span></span>
          )}
          {hasMl && mlFd != null && (
            <span>ml <span className="text-zinc-300">{mlFd.toFixed(1)}</span></span>
          )}
        </div>
        {divergent && <DeltaBadge delta={delta} />}
      </div>
    );
  }

  // Row variant — tight horizontal with small context underneath.
  return (
    <div className="inline-flex items-center gap-2">
      <HeadlineColumn fd={headlineFd} dk={headlineDk} size="sm" />
      <div className="flex flex-col items-start gap-0 font-mono text-[9px] leading-none text-zinc-600">
        {hasFactor && factorFd != null && <span>f {factorFd.toFixed(1)}</span>}
        {hasMl && mlFd != null && <span>m {mlFd.toFixed(1)}</span>}
      </div>
      {divergent && <DeltaBadge delta={delta} compact />}
    </div>
  );
}

function HeadlineColumn({
  fd,
  dk,
  size,
}: {
  fd: number | null | undefined;
  dk?: number | null | undefined;
  size: 'sm' | 'lg';
}) {
  const has = fd != null && !Number.isNaN(fd);
  const mainClass =
    size === 'lg' ? 'text-3xl leading-none font-semibold' :
                    'text-base leading-none font-semibold';
  const subClass =
    size === 'lg' ? 'text-xs mt-1' : 'text-[10px] mt-0.5';
  return (
    <div className="flex flex-col items-end font-mono">
      <span className="text-[9px] uppercase tracking-[0.15em] text-oracle-green">
        FD Proj
      </span>
      <span className={cn(mainClass, has ? 'text-oracle-green' : 'text-zinc-600')}>
        {has ? fd!.toFixed(1) : '—'}
      </span>
      {dk != null && (
        <span className={cn(subClass, 'text-zinc-500')}>
          DK {dk.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function DeltaBadge({ delta, compact = false }: { delta: number; compact?: boolean }) {
  const up = delta > 0;
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded px-1 py-0.5 font-mono leading-none',
        up ? 'text-oracle-green bg-oracle-green/10' : 'text-oracle-rose bg-oracle-rose/10',
      )}
      title={`Model disagreement: ML ${up ? '+' : ''}${delta.toFixed(1)} vs Factor`}
    >
      <span className={compact ? 'text-xs' : 'text-sm'}>{up ? '↑' : '↓'}</span>
      <span className={compact ? 'mt-0.5 text-[9px]' : 'mt-0.5 text-[10px]'}>
        {Math.abs(delta).toFixed(1)}
      </span>
    </div>
  );
}
