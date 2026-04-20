import Link from 'next/link';
import { Thermometer, Wind, Clock, MapPin } from 'lucide-react';
import { getSlate, getTodayGameDates } from '@/lib/db/queries';
import { TeamBadge } from '@/components/team-badge';
import { Ring } from '@/components/ring';
import { NrfiSparkline } from '@/components/nrfi-sparkline';
import type { NrfiPitcherSummary } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Weather = { tempF?: number; windSpeedMph?: number; windDir?: string };

const PRESETS = [
  { id: 'ace-duel',  label: 'ACE DUEL',  hint: 'both FIP < 3.5' },
  { id: 'high-conf', label: 'HIGH CONF', hint: 'NRFI ≥ 60% or ≤ 30%' },
  { id: 'over-edge', label: 'OVER EDGE', hint: 'NRFI ≤ 40%' },
  { id: 'wind-out',  label: 'WIND OUT',  hint: '≥ 10 mph out' },
] as const;

type PresetId = typeof PRESETS[number]['id'];

function fmtTime(ts: Date | string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function nrfiTone(pct: number | null) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 55) return 'green' as const;
  if (pct <= 35) return 'rose' as const;
  return 'amber' as const;
}

function windIsOut(w: Weather | undefined) {
  if (!w || !w.windSpeedMph || !w.windDir) return false;
  const d = w.windDir.toLowerCase();
  // Common outfield-directional markers. "Out to CF/LF/RF" or "out" in direction text.
  return d.includes('out') || /^(cf|lf|rf)/.test(d);
}

type SlateRow = Awaited<ReturnType<typeof getSlate>>[number];

function applyPreset(games: SlateRow[], preset: PresetId | null): SlateRow[] {
  if (!preset) return games;
  return games.filter((g) => {
    const pct = g.nrfiPct ?? null;
    const home = g.homePitcher as NrfiPitcherSummary | null;
    const away = g.awayPitcher as NrfiPitcherSummary | null;
    const weather = (g.weather ?? null) as Weather | null;
    if (preset === 'ace-duel') return (home?.fip ?? 99) < 3.5 && (away?.fip ?? 99) < 3.5;
    if (preset === 'high-conf') return pct != null && (pct >= 60 || pct <= 30);
    if (preset === 'over-edge') return pct != null && pct <= 40;
    if (preset === 'wind-out') return !!weather && (weather.windSpeedMph ?? 0) >= 10 && windIsOut(weather);
    return true;
  });
}

export default async function SlatePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; preset?: string }>;
}) {
  const params = await searchParams;
  const availableDates = await getTodayGameDates();
  const date =
    params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);
  const rawPreset = (PRESETS.find((p) => p.id === params.preset)?.id ?? null) as PresetId | null;
  const allGames = await getSlate(date);
  const games = applyPreset(allGames, rawPreset);

  const totalNrfi = games.reduce((s, g) => s + (g.nrfiPct ?? 0), 0);
  const avgNrfi = games.length ? totalNrfi / games.length : null;

  return (
    <div className="min-h-screen">
      <Header
        date={date}
        preset={rawPreset}
        gameCount={games.length}
        totalCount={allGames.length}
        avgNrfi={avgNrfi}
        availableDates={availableDates}
      />

      <div className="px-6 pb-12 md:px-8">
        {allGames.length === 0 ? (
          <EmptyState />
        ) : games.length === 0 ? (
          <FilteredEmpty preset={rawPreset} date={date} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {games.map((g) => (
              <GameCard key={g.gamePk as number} g={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({
  date,
  preset,
  gameCount,
  totalCount,
  avgNrfi,
  availableDates,
}: {
  date: string;
  preset: PresetId | null;
  gameCount: number;
  totalCount: number;
  avgNrfi: number | null;
  availableDates: string[];
}) {
  return (
    <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-section">Slate</div>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-50">
            {new Date(date + 'T12:00:00').toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h1>
          <div className="mt-2 flex items-center gap-4 font-mono text-xs text-zinc-500">
            <span>
              <span className="text-zinc-200">{gameCount}</span>
              {preset != null && gameCount !== totalCount && (
                <span className="text-zinc-600"> / {totalCount}</span>
              )}{' '}
              games
            </span>
            {avgNrfi != null && (
              <>
                <span className="text-zinc-700">·</span>
                <span>avg NRFI <span className="text-zinc-200">{avgNrfi.toFixed(1)}%</span></span>
              </>
            )}
            <span className="text-zinc-700">·</span>
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-oracle-green" />
              confirmed
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-oracle-amber" />
              projected
            </span>
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
                href={preset ? `/slate?date=${d}&preset=${preset}` : `/slate?date=${d}`}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
          presets
        </span>
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <Link
              key={p.id}
              href={
                active
                  ? `/slate?date=${date}`
                  : `/slate?date=${date}&preset=${p.id}`
              }
              className={
                'inline-flex flex-col rounded-md border px-2.5 py-1 transition ' +
                (active
                  ? 'border-oracle-green/50 bg-oracle-green/10'
                  : 'border-hairline bg-[var(--surface-1)] hover:border-hairline-strong hover:bg-[var(--surface-2)]')
              }
            >
              <span
                className={
                  'font-mono text-[10px] font-semibold tracking-widest ' +
                  (active ? 'text-oracle-green' : 'text-zinc-200')
                }
              >
                {p.label}
              </span>
              <span className="font-mono text-[9px] text-zinc-500">{p.hint}</span>
            </Link>
          );
        })}
        {preset && (
          <Link
            href={`/slate?date=${date}`}
            className="font-mono text-[10px] text-zinc-500 hover:text-oracle-rose"
          >
            clear ×
          </Link>
        )}
      </div>
    </div>
  );
}

function GameCard({ g }: { g: SlateRow }) {
  const tone = nrfiTone(g.nrfiPct ?? null);
  const home = g.homePitcher as NrfiPitcherSummary | null;
  const away = g.awayPitcher as NrfiPitcherSummary | null;
  const weather = (g.weather ?? null) as Weather | null;
  const homeSrc = (g as unknown as { homeLineupSource?: string | null }).homeLineupSource ?? null;
  const awaySrc = (g as unknown as { awayLineupSource?: string | null }).awayLineupSource ?? null;

  return (
    <Link href={`/games/${g.gamePk}`} className="group">
      <div className="lift card-gradient relative overflow-hidden rounded-xl border border-hairline p-5 transition group-hover:border-oracle-green/40">
        {/* Top row: time + venue */}
        <div className="mb-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fmtTime(g.gameTimeUtc)}
          </span>
          <span className="truncate">
            <MapPin className="mr-1 inline h-3 w-3 opacity-60" />
            {g.venueName ?? 'TBD'}
          </span>
        </div>

        {/* Matchup */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <TeamBadge abbrev={g.awayAbbrev} size="md" />
              <span className="text-xs text-zinc-500">@</span>
              <TeamBadge abbrev={g.homeAbbrev} size="md" />
            </div>
            <div className="mt-3 flex flex-col gap-0.5 font-mono text-[11px] text-zinc-400">
              <PitcherLine label={g.awayAbbrev} pitcher={away} lineupSource={awaySrc} />
              <PitcherLine label={g.homeAbbrev} pitcher={home} lineupSource={homeSrc} />
            </div>
          </div>

          <Ring
            value={g.nrfiPct ?? 0}
            size={78}
            strokeWidth={7}
            tone={tone}
          >
            <div className="flex flex-col items-center">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                NRFI
              </span>
              <span className="mt-0.5 text-2xl font-semibold leading-none text-zinc-50">
                {g.nrfiPct != null ? g.nrfiPct.toFixed(0) : '—'}
                <span className="ml-0.5 text-sm text-zinc-500">%</span>
              </span>
            </div>
          </Ring>
        </div>

        {/* Sparkline + weather footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <NrfiSparkline points={g.nrfiTrend ?? []} tone={tone} />
          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
            {weather?.tempF != null && (
              <span className="inline-flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {weather.tempF}°F
              </span>
            )}
            {weather?.windSpeedMph != null && weather.windSpeedMph > 0 && (
              <span className="inline-flex items-center gap-1">
                <Wind className="h-3 w-3" />
                {weather.windSpeedMph} {weather.windDir ?? ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PitcherLine({
  label,
  pitcher,
  lineupSource,
}: {
  label: string | null | undefined;
  pitcher: NrfiPitcherSummary | null;
  lineupSource?: string | null;
}) {
  const fip = pitcher?.fip;
  const hasPitcher = !!pitcher?.pitcher_name;
  const dotClass = !hasPitcher
    ? 'bg-zinc-700'
    : lineupSource === 'confirmed'
    ? 'bg-oracle-green shadow-[0_0_4px_var(--color-oracle-green)]'
    : lineupSource === 'fallback'
    ? 'bg-oracle-amber'
    : 'bg-zinc-500';
  const dotTitle = !hasPitcher
    ? 'No probable pitcher posted'
    : lineupSource === 'confirmed'
    ? 'Confirmed lineup'
    : lineupSource === 'fallback'
    ? 'Projected — using previous game lineup'
    : 'Lineup source unknown';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <span
          className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotClass}`}
          title={dotTitle}
          aria-label={dotTitle}
        />
        <span className="text-zinc-600">{label ?? '—'}</span>{' '}
        <span className="text-zinc-200">{pitcher?.pitcher_name ?? 'TBD'}</span>
      </span>
      {fip != null && (
        <span className="font-mono text-[10px] text-zinc-500">
          FIP <span className="text-zinc-300">{fip.toFixed(2)}</span>
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
      <div className="h-section">Empty slate</div>
      <p className="max-w-md text-zinc-400">
        No games with projections for this date. Run the pipeline.
      </p>
    </div>
  );
}

function FilteredEmpty({ preset, date }: { preset: PresetId | null; date: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
      <div className="h-section">No matches</div>
      <p className="max-w-md text-zinc-400">
        No games match the {preset} filter today.{' '}
        <Link href={`/slate?date=${date}`} className="text-oracle-green hover:underline">
          Clear
        </Link>
        .
      </p>
    </div>
  );
}
