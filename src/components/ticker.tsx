import { getSlate, getTodayGameDates } from '@/lib/db/queries';
import { ThemeToggle } from './theme-toggle';
import type { NrfiPitcherSummary } from '@/lib/db/schema';

export async function Ticker() {
  const dates = await getTodayGameDates();
  const date = dates[0] ?? new Date().toISOString().slice(0, 10);
  const games = await getSlate(date);

  // Build ticker items: NRFI% per matchup + FIP per listed starter
  type Item = { label: string; val: string; tone: 'up' | 'dn' | 'neutral'; note: string };
  const items: Item[] = [];
  for (const g of games) {
    const pct = g.nrfiPct ?? null;
    items.push({
      label: `${g.awayAbbrev ?? '—'}@${g.homeAbbrev ?? '—'}`,
      val: pct != null ? `${pct.toFixed(0)}%` : '—',
      tone: pct == null ? 'neutral' : pct >= 55 ? 'up' : pct <= 35 ? 'dn' : 'neutral',
      note: 'NRFI',
    });
    const home = g.homePitcher as NrfiPitcherSummary | null;
    const away = g.awayPitcher as NrfiPitcherSummary | null;
    for (const p of [away, home]) {
      if (!p?.pitcher_name || p.fip == null) continue;
      items.push({
        label: p.pitcher_name.split(' ').slice(-1)[0],
        val: p.fip.toFixed(2),
        tone: p.fip < 3.3 ? 'up' : p.fip > 4.3 ? 'dn' : 'neutral',
        note: 'FIP',
      });
    }
  }

  const chain = items.length ? [...items, ...items] : [];

  return (
    <div className="relative flex h-8 items-center overflow-hidden border-b border-hairline bg-[var(--surface-1)]">
      {chain.length > 0 ? (
        <div className="ticker-track flex shrink-0 items-center gap-7 whitespace-nowrap pl-4 pr-40 font-mono text-[11px]">
          {chain.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-zinc-500">
              <b className="font-semibold text-zinc-200">{it.label}</b>
              <span
                className={
                  it.tone === 'up'
                    ? 'text-oracle-green'
                    : it.tone === 'dn'
                    ? 'text-oracle-rose'
                    : 'text-zinc-400'
                }
              >
                {it.val}
              </span>
              <span className="opacity-60">{it.note}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="pl-4 font-mono text-[11px] text-zinc-500">no slate loaded</div>
      )}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-44 bg-gradient-to-l from-[var(--surface-1)] via-[var(--surface-1)] to-transparent" />
      <div className="absolute inset-y-0 right-3 flex items-center">
        <ThemeToggle />
      </div>
      <style>{`
        @keyframes oracle-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { animation: oracle-ticker 90s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
