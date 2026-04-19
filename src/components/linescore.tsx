import { cn } from '@/lib/utils';
import type { Linescore } from '@/lib/mlb-live';

export function LinescoreTable({
  linescore,
  homeAbbr,
  awayAbbr,
}: {
  linescore: Linescore;
  homeAbbr: string | null;
  awayAbbr: string | null;
}) {
  const innings = linescore.innings ?? [];
  const maxInning = Math.max(9, innings.length);
  const nums = Array.from({ length: maxInning }, (_, i) => i + 1);

  const tTotals = linescore.teams ?? {};

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-[var(--surface-1)]">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-hairline-strong text-zinc-500">
            <th className="px-3 py-2 text-left uppercase tracking-widest text-[10px]">Team</th>
            {nums.map((n) => (
              <th key={n} className="px-2 py-2 text-center uppercase tracking-widest text-[10px]">{n}</th>
            ))}
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">R</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">H</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">E</th>
          </tr>
        </thead>
        <tbody>
          {(['away', 'home'] as const).map((side) => {
            const abbrev = side === 'away' ? awayAbbr : homeAbbr;
            const t = (tTotals as Record<string, { runs?: number; hits?: number; errors?: number }>)[side] ?? {};
            return (
              <tr key={side} className={cn(
                'border-b border-hairline/60 last:border-0',
                side === 'home' && 'bg-[var(--surface-0)]/40',
              )}>
                <td className="px-3 py-2 font-semibold text-zinc-200">{abbrev ?? '—'}</td>
                {nums.map((n) => {
                  const inn = innings.find((i) => i.num === n);
                  const r = (inn?.[side] as { runs?: number } | undefined)?.runs;
                  return (
                    <td
                      key={n}
                      className={cn(
                        'px-2 py-2 text-center',
                        r === undefined ? 'text-zinc-700' :
                        r === 0 ? 'text-zinc-500' :
                        r >= 3 ? 'text-oracle-amber font-semibold' :
                                 'text-zinc-200',
                      )}
                    >
                      {r !== undefined ? r : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-zinc-100">
                  {t.runs ?? '—'}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300">{t.hits ?? '—'}</td>
                <td className="px-3 py-2 text-right text-zinc-500">{t.errors ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
