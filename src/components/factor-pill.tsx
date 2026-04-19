import { cn } from '@/lib/utils';

type Signal = -1 | 0 | 1;

const LABEL: Record<string, string> = {
  park: 'Park',
  weather: 'Wx',
  platoon: 'Plat',
  stuffQuality: 'Stuff',
  recentForm: 'Form',
  battingOrder: 'Order',
  matchup: 'Match',
};

const EXPLAIN: Record<string, string> = {
  park: 'Park factors (HR, hit, K) relative to league',
  weather: 'Temp + wind effect on HR likelihood',
  platoon: 'Batter vs pitcher handedness advantage',
  stuffQuality: 'Pitcher velocity + spin vs league baseline',
  recentForm: 'Hitter hot/cold over last 7 games',
  battingOrder: 'Lineup slot → expected plate appearances',
  matchup: 'Whiff rate vs pitcher primary pitch family',
};

export function FactorPill({
  label,
  signal,
}: {
  label: keyof typeof LABEL | string;
  signal: Signal | number | undefined;
}) {
  const s = (signal ?? 0) as Signal;
  const tone =
    s === 1
      ? 'border-oracle-green/30 text-oracle-green bg-oracle-green/10'
      : s === -1
        ? 'border-oracle-rose/30 text-oracle-rose bg-oracle-rose/10'
        : 'border-zinc-700/80 text-zinc-500 bg-zinc-900/30';
  const arrow = s === 1 ? '↑' : s === -1 ? '↓' : '·';
  const title = `${EXPLAIN[label] ?? label} — signal ${s === 1 ? '+1' : s === -1 ? '-1' : '0'}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        tone,
      )}
      title={title}
    >
      {LABEL[label] ?? label}
      <span className="ml-0.5 opacity-80">{arrow}</span>
    </span>
  );
}
