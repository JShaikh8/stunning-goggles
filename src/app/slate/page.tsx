import Link from 'next/link';
import { Thermometer, Wind, Clock, MapPin } from 'lucide-react';
import { getSlate, getTodayGameDates } from '@/lib/db/queries';
import { TeamBadge } from '@/components/team-badge';
import { Ring } from '@/components/ring';
import type { NrfiPitcherSummary } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

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

export default async function SlatePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const availableDates = await getTodayGameDates();
  const date =
    params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);
  const games = await getSlate(date);

  const totalNrfi = games.reduce((s, g) => s + (g.nrfiPct ?? 0), 0);
  const avgNrfi = games.length ? totalNrfi / games.length : null;

  return (
    <div className="min-h-screen">
      <Header
        date={date}
        gameCount={games.length}
        avgNrfi={avgNrfi}
        availableDates={availableDates}
      />

      <div className="px-6 pb-12 md:px-8">
        {games.length === 0 ? (
          <EmptyState />
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
  gameCount,
  avgNrfi,
  availableDates,
}: {
  date: string;
  gameCount: number;
  avgNrfi: number | null;
  availableDates: string[];
}) {
  const [, month, day] = date.split('-');
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
            <span><span className="text-zinc-200">{gameCount}</span> games</span>
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
                href={`/slate?date=${d}`}
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
  );
}

type SlateRow = Awaited<ReturnType<typeof getSlate>>[number];

function GameCard({ g }: { g: SlateRow }) {
  const tone = nrfiTone(g.nrfiPct ?? null);
  const home = g.homePitcher as NrfiPitcherSummary | null;
  const away = g.awayPitcher as NrfiPitcherSummary | null;
  const weather = (g as unknown as { weather?: { tempF?: number; windSpeedMph?: number; windDir?: string } }).weather;

  return (
    <Link href={`/games/${g.gamePk}`} className="group">
      <div className="lift card-gradient relative overflow-hidden rounded-xl border border-hairline p-5 transition group-hover:border-oracle-green/40">
        {/* Top row: time + venue + status */}
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
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <TeamBadge abbrev={g.awayAbbrev} size="md" />
              <span className="text-xs text-zinc-500">@</span>
              <TeamBadge abbrev={g.homeAbbrev} size="md" />
            </div>
            <div className="mt-3 flex flex-col gap-0.5 font-mono text-[11px] text-zinc-400">
              <PitcherLine label={g.awayAbbrev} pitcher={away} />
              <PitcherLine label={g.homeAbbrev} pitcher={home} />
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
              <span className="text-2xl font-semibold text-zinc-50 leading-none mt-0.5">
                {g.nrfiPct != null ? g.nrfiPct.toFixed(0) : '—'}
                <span className="text-sm text-zinc-500 ml-0.5">%</span>
              </span>
            </div>
          </Ring>
        </div>

        {/* Weather footer */}
        {weather && (weather.tempF || weather.windSpeedMph) && (
          <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3 font-mono text-[10px] text-zinc-500">
            {weather.tempF != null && (
              <span className="inline-flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {weather.tempF}°F
              </span>
            )}
            {weather.windSpeedMph != null && weather.windSpeedMph > 0 && (
              <span className="inline-flex items-center gap-1">
                <Wind className="h-3 w-3" />
                {weather.windSpeedMph} mph {weather.windDir ?? ''}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function PitcherLine({
  label,
  pitcher,
}: {
  label: string | null | undefined;
  pitcher: NrfiPitcherSummary | null;
}) {
  const fip = pitcher?.fip;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate">
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
