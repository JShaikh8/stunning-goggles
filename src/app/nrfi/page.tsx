import Link from 'next/link';
import { Clock, MapPin, Thermometer, Wind } from 'lucide-react';
import { getNrfiSlate, getTodayGameDates } from '@/lib/db/queries';
import { Ring } from '@/components/ring';
import { TeamBadge } from '@/components/team-badge';
import type { NrfiBatterSummary } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function fmtTime(ts: Date | string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function nrfiTone(pct: number | null | undefined) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 60) return 'green' as const;
  if (pct <= 45) return 'rose' as const;
  return 'amber' as const;
}

type PitcherSum = {
  pitcher_id?: number;
  pitcher_name?: string;
  fip?: number | null;
};

export default async function NrfiPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const availableDates = await getTodayGameDates();
  const date =
    params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);
  const games = await getNrfiSlate(date);

  const avgNrfi = games.length
    ? games.reduce((s, g) => s + (g.nrfiPct ?? 0), 0) / games.length
    : null;

  return (
    <div className="min-h-screen">
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="h-section">NRFI board</div>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-50">
              No Runs First Inning
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Markov-chain first-inning simulation using per-PA outcome probabilities
              from our matchup classifier. Each batter&apos;s outcome affects base-out state
              which feeds the next batter — proper sequence modeling, not independent events.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-500">
              <span>{date}</span>
              <span className="text-zinc-700">·</span>
              <span><span className="text-zinc-200">{games.length}</span> games</span>
              {avgNrfi != null && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span>avg NRFI <span className="text-zinc-200">{avgNrfi.toFixed(1)}%</span></span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase text-zinc-500">
            <span className="mr-1 text-zinc-600">recent:</span>
            {availableDates.slice(0, 8).map((d) => {
              const [, m, dd] = d.split('-');
              const active = d === date;
              return (
                <Link
                  key={d}
                  href={`/nrfi?date=${d}`}
                  className={
                    active
                      ? 'rounded bg-oracle-green/15 px-2 py-1 text-oracle-green'
                      : 'rounded px-2 py-1 text-zinc-500 hover:bg-[var(--surface-2)] hover:text-zinc-200'
                  }
                >
                  {m}/{dd}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {games.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
            <div className="h-section">No NRFI projections for this date</div>
            <p className="max-w-md text-zinc-400">
              Run the pipeline: <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">python run_daily.py</code>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {games.map((g) => (
              <NrfiCard key={g.gamePk} g={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Game = Awaited<ReturnType<typeof getNrfiSlate>>[number];

function NrfiCard({ g }: { g: Game }) {
  const tone = nrfiTone(g.nrfiPct);
  const homePitcher = g.homePitcher as PitcherSum | null;
  const awayPitcher = g.awayPitcher as PitcherSum | null;
  const homeBats = (g.homeTopBatters ?? []) as NrfiBatterSummary[];
  const awayBats = (g.awayTopBatters ?? []) as NrfiBatterSummary[];
  const weather = g.weather as { tempF?: number; windSpeedMph?: number; windDir?: string } | null;

  const homeScorePct = (g.homePScore ?? 0) * 100;
  const awayScorePct = (g.awayPScore ?? 0) * 100;

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-[var(--surface-1)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline p-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <TeamBadge abbrev={g.awayAbbrev} size="md" />
            <span className="text-zinc-600">@</span>
            <TeamBadge abbrev={g.homeAbbrev} size="md" />
          </div>
          <Link
            href={`/games/${g.gamePk}`}
            className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-oracle-green"
          >
            game detail →
          </Link>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />{fmtTime(g.gameTimeUtc)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />{g.venueName ?? '—'}
          </span>
          {weather?.tempF != null && (
            <span className="inline-flex items-center gap-1">
              <Thermometer className="h-3 w-3" />{weather.tempF}°F
            </span>
          )}
          {weather?.windSpeedMph != null && weather.windSpeedMph > 0 && (
            <span className="inline-flex items-center gap-1">
              <Wind className="h-3 w-3" />{weather.windSpeedMph} mph {weather.windDir ?? ''}
            </span>
          )}
        </div>
      </div>

      {/* Main grid: NRFI ring + two team blocks */}
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[auto_1fr_1fr]">
        {/* Ring */}
        <div className="flex flex-col items-center justify-center gap-3 border-b border-hairline p-6 md:border-b-0 md:border-r">
          <Ring value={g.nrfiPct ?? 0} size={120} strokeWidth={10} tone={tone}>
            <div className="flex flex-col items-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">NRFI</span>
              <span className="text-4xl font-bold text-zinc-50 leading-none mt-1">
                {g.nrfiPct?.toFixed(0) ?? '—'}%
              </span>
            </div>
          </Ring>
          <div className="text-center font-mono text-[11px] text-zinc-500">
            YRFI <span className="text-zinc-300">{g.yrfiPct?.toFixed(0)}%</span>
            {'  ·  '}
            xR <span className="text-zinc-300">{((g.homeXr ?? 0) + (g.awayXr ?? 0)).toFixed(2)}</span>
          </div>
        </div>

        <TeamFirstInning
          label={g.awayAbbrev ?? 'AWAY'}
          batters={awayBats}
          pitcher={homePitcher}
          xr={g.awayXr ?? 0}
          pZero={g.awayPScoreless ?? 0}
          pScorePct={awayScorePct}
        />

        <TeamFirstInning
          label={g.homeAbbrev ?? 'HOME'}
          batters={homeBats}
          pitcher={awayPitcher}
          xr={g.homeXr ?? 0}
          pZero={g.homePScoreless ?? 0}
          pScorePct={homeScorePct}
          borderLeft
        />
      </div>
    </div>
  );
}

function TeamFirstInning({
  label,
  batters,
  pitcher,
  xr,
  pZero,
  pScorePct,
  borderLeft = false,
}: {
  label: string;
  batters: NrfiBatterSummary[];
  pitcher: PitcherSum | null;
  xr: number;
  pZero: number;
  pScorePct: number;
  borderLeft?: boolean;
}) {
  return (
    <div className={cn('flex flex-col', borderLeft && 'md:border-l md:border-hairline')}>
      <div className="flex items-center justify-between border-b border-hairline bg-[var(--surface-0)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TeamBadge abbrev={label} size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            facing <span className="text-zinc-300">{pitcher?.pitcher_name ?? 'TBD'}</span>
            {pitcher?.fip != null && (
              <span className="ml-2">FIP <span className="text-zinc-300">{pitcher.fip.toFixed(2)}</span></span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>xR <span className="text-zinc-200">{xr.toFixed(2)}</span></span>
          <span>P(0) <span className="text-zinc-200">{(pZero * 100).toFixed(0)}%</span></span>
        </div>
      </div>

      {/* Team score probability bar */}
      <div className="border-b border-hairline bg-[var(--surface-0)]/40 px-4 py-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {label} scores in 1st
          </span>
          <span className={cn(
            'font-mono text-base font-semibold',
            pScorePct >= 55 ? 'text-oracle-rose' :
            pScorePct <= 35 ? 'text-oracle-green' :
                              'text-oracle-amber',
          )}>
            {pScorePct.toFixed(0)}%
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              'absolute left-0 top-0 h-full rounded-full transition-all',
              pScorePct >= 55 ? 'bg-oracle-rose/80' :
              pScorePct <= 35 ? 'bg-oracle-green/80' :
                                'bg-oracle-amber/80',
            )}
            style={{ width: `${Math.min(100, pScorePct)}%` }}
          />
        </div>
      </div>

      <ul className="divide-y divide-hairline">
        {batters.length === 0 ? (
          <li className="p-4 text-center text-zinc-600">No lineup yet</li>
        ) : (
          batters.slice(0, 5).map((b) => <BatterRow key={b.hitter_id} b={b} />)
        )}
      </ul>
    </div>
  );
}

function BatterRow({ b }: { b: NrfiBatterSummary }) {
  const ob = b.p_on_base ?? 0;
  // Slot-weighted approximation of score probability given OB
  const slotScoreMult =
    b.lineup_slot <= 3 ? 0.45 : b.lineup_slot === 4 ? 0.28 : 0.14;
  const scoreProb = ob * slotScoreMult + (b.probs?.home_run ?? 0);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-hairline font-mono text-xs text-zinc-400">
        {b.lineup_slot}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-zinc-100">
          <Link href={`/hitters/${b.hitter_id}`} className="hover:text-oracle-green">
            {b.hitter_name}
          </Link>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
          FI weight <span className="text-zinc-300">{b.fi_weight.toFixed(2)}</span>
          {b.probs?.home_run != null && (
            <> · HR <span className="text-zinc-300">{(b.probs.home_run * 100).toFixed(1)}%</span></>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 font-mono text-xs">
        <Prob label="OB" value={ob} tone="sky" />
        <Prob label="Score" value={scoreProb} tone="amber" />
      </div>
    </li>
  );
}

function Prob({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'sky' | 'amber';
}) {
  const tc = tone === 'sky' ? 'text-oracle-sky' : 'text-oracle-amber';
  return (
    <div className="flex flex-col items-end">
      <span className="text-[9px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={cn('text-sm font-semibold', tc)}>
        {(Math.max(0, Math.min(1, value)) * 100).toFixed(0)}%
      </span>
    </div>
  );
}
