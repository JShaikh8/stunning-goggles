import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, MapPin, Thermometer, Wind } from 'lucide-react';
import { getGameDetail } from '@/lib/db/queries';
import { fetchLiveGame } from '@/lib/mlb-live';
import { FactorPill } from '@/components/factor-pill';
import { ProjectionTriple } from '@/components/projection-triple';
import { Ring } from '@/components/ring';
import { TeamBadge } from '@/components/team-badge';
import { SideBadge } from '@/components/side-badge';
import { LinescoreTable } from '@/components/linescore';
import { BoxscoreBlock } from '@/components/boxscore-tables';
import type { FactorMap } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function fmtTime(ts: Date | string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function nrfiTone(pct: number | null | undefined) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 55) return 'green' as const;
  if (pct <= 35) return 'rose' as const;
  return 'amber' as const;
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}) {
  const { gamePk } = await params;
  const detail = await getGameDetail(Number(gamePk));
  if (!detail) notFound();
  const { game, homeTeam, awayTeam, hitters, pitchers, nrfi } = detail;

  // Live game state — linescore + boxscore for in-progress / final games.
  const live = await fetchLiveGame(Number(gamePk));
  const liveState = live?.gameData?.status?.abstractGameState ?? game.status;
  const showLive = liveState === 'Live' || liveState === 'Final' || liveState === 'final' || liveState === 'in_progress';
  const linescore = live?.liveData?.linescore;
  const boxscore  = live?.liveData?.boxscore;

  const homeHitters = hitters.filter((h) => h.side === 'home');
  const awayHitters = hitters.filter((h) => h.side === 'away');
  const homePitcher = pitchers.find((p) => p.side === 'home');
  const awayPitcher = pitchers.find((p) => p.side === 'away');
  const weather = (game as unknown as { weather?: { tempF?: number; windSpeedMph?: number; windDir?: string } }).weather;
  const time = fmtTime((game as { gameTimeUtc?: Date | null }).gameTimeUtc);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-6 md:px-8">
        <Link
          href="/slate"
          className="group mb-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" />
          back to slate
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="h-section">Game</div>
            <div className="mt-2 flex items-center gap-4">
              <TeamName team={awayTeam?.abbrev} name={awayTeam?.name} />
              <span className="text-2xl text-zinc-600">@</span>
              <TeamName team={homeTeam?.abbrev} name={homeTeam?.name} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-500">
              <span>{game.gameDate as unknown as string}</span>
              {time && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />{time}
                  </span>
                </>
              )}
              <span className="text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />{(game as { venueName?: string }).venueName ?? 'venue TBD'}
              </span>
              {weather?.tempF != null && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />{weather.tempF}°F
                  </span>
                </>
              )}
              {weather?.windSpeedMph != null && weather.windSpeedMph > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Wind className="h-3 w-3" />{weather.windSpeedMph} mph {weather.windDir ?? ''}
                </span>
              )}
            </div>
          </div>

          {nrfi && (
            <div className="flex items-center gap-4 rounded-xl border border-hairline bg-[var(--surface-1)] px-5 py-4">
              <Ring value={nrfi.nrfiPct ?? 0} size={84} strokeWidth={7} tone={nrfiTone(nrfi.nrfiPct ?? null)}>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">NRFI</span>
                  <span className="mt-0.5 text-2xl font-semibold text-zinc-50 leading-none">
                    {nrfi.nrfiPct?.toFixed(0) ?? '—'}%
                  </span>
                </div>
              </Ring>
              <div className="flex flex-col gap-0.5 font-mono text-[11px] text-zinc-400">
                <div>
                  xR home <span className="text-zinc-200">{nrfi.homeXr?.toFixed(2)}</span>
                </div>
                <div>
                  xR away <span className="text-zinc-200">{nrfi.awayXr?.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-[10px] text-zinc-600">yrfi {nrfi.yrfiPct?.toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Linescore + Boxscore when live/final */}
        {showLive && linescore && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="h-section">Linescore</div>
              {live?.gameData?.status?.detailedState && (
                <span className={
                  liveState === 'Live' || liveState === 'in_progress'
                    ? 'font-mono text-[10px] uppercase tracking-widest text-oracle-green'
                    : 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
                }>
                  {live.gameData.status.detailedState}
                  {linescore.currentInningOrdinal && (linescore.currentInningOrdinal.length > 0) && liveState === 'Live'
                    ? ` · ${linescore.inningState ?? ''} ${linescore.currentInningOrdinal}`
                    : ''}
                </span>
              )}
            </div>
            <LinescoreTable
              linescore={linescore}
              homeAbbr={homeTeam?.abbrev ?? null}
              awayAbbr={awayTeam?.abbrev ?? null}
            />
          </div>
        )}

        {showLive && boxscore && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="h-section">Boxscore</div>
            <BoxscoreBlock
              boxscore={boxscore}
              homeAbbr={homeTeam?.abbrev ?? null}
              awayAbbr={awayTeam?.abbrev ?? null}
            />
          </div>
        )}

        {/* Starter matchup */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <PitcherCard title={awayTeam?.abbrev ?? 'AWAY'} pitcher={awayPitcher} />
          <PitcherCard title={homeTeam?.abbrev ?? 'HOME'} pitcher={homePitcher} />
        </div>

        {/* Lineups */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LineupCard
            teamAbbrev={awayTeam?.abbrev ?? 'AWAY'}
            teamName={awayTeam?.name ?? 'Away'}
            hitters={awayHitters}
          />
          <LineupCard
            teamAbbrev={homeTeam?.abbrev ?? 'HOME'}
            teamName={homeTeam?.name ?? 'Home'}
            hitters={homeHitters}
          />
        </div>
      </div>
    </div>
  );
}

function TeamName({ team, name }: { team: string | null | undefined; name: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1.5">
      <TeamBadge abbrev={team} size="lg" />
      <span className="text-[11px] font-mono text-zinc-500">{name ?? ''}</span>
    </div>
  );
}

type PitcherRow = Awaited<ReturnType<typeof getGameDetail>> extends { pitchers: (infer T)[] } | null
  ? T
  : never;

function PitcherCard({ title, pitcher }: { title: string; pitcher: PitcherRow | undefined }) {
  if (!pitcher) {
    return (
      <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
        <div className="h-section">{title} starter</div>
        <div className="mt-2 text-zinc-600">No projection</div>
      </div>
    );
  }
  const proj = pitcher.proj as { ip?: number; k?: number; bb?: number; h?: number } | null;
  return (
    <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="h-section">{title} starter</div>
          <div className="mt-1 flex items-center gap-2">
            <Link
              href={`/pitchers/${pitcher.pitcherId}`}
              className="text-xl font-semibold text-zinc-100 hover:text-oracle-green"
            >
              {pitcher.pitcherName ?? '—'}
            </Link>
            <SideBadge side={pitcher.pitcherHand} suffix="HP" />
          </div>
        </div>
        <div className="text-right font-mono text-[11px]">
          <div className="text-zinc-500">FIP</div>
          <div className="text-lg font-semibold text-zinc-200">
            {pitcher.fip?.toFixed(2) ?? '—'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ProjectionTriple
          factorDk={pitcher.dkPts}
          factorFd={pitcher.fdPts}
          mlDk={pitcher.mlDkPts}
          mlFd={pitcher.mlFdPts}
          variant="block"
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 border-t border-hairline pt-3 font-mono text-xs">
        <StatCell label="IP"  value={proj?.ip?.toFixed(1) ?? '—'} />
        <StatCell label="K"   value={proj?.k?.toFixed(1)  ?? '—'} />
        <StatCell label="BB"  value={proj?.bb?.toFixed(1) ?? '—'} />
        <StatCell label="H"   value={proj?.h?.toFixed(1)  ?? '—'} />
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200">{value}</div>
    </div>
  );
}

type HitterRow = Awaited<ReturnType<typeof getGameDetail>> extends { hitters: (infer T)[] } | null
  ? T
  : never;

function LineupCard({
  teamAbbrev,
  teamName,
  hitters,
}: {
  teamAbbrev: string;
  teamName: string;
  hitters: HitterRow[];
}) {
  return (
    <div className="rounded-xl border border-hairline bg-[var(--surface-1)]">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <div className="flex items-center gap-2">
          <TeamBadge abbrev={teamAbbrev} />
          <span className="text-sm font-semibold text-zinc-200">{teamName}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {hitters.length} bats
        </span>
      </div>
      {hitters.length === 0 ? (
        <div className="p-8 text-center text-zinc-600">No lineup yet</div>
      ) : (
        <ul className="divide-y divide-hairline">
          {hitters
            .sort((a, b) => (a.lineupSlot ?? 99) - (b.lineupSlot ?? 99))
            .map((h) => (
              <HitterRow key={h.hitterId as number} h={h} />
            ))}
        </ul>
      )}
    </div>
  );
}

function HitterRow({ h }: { h: HitterRow }) {
  return (
    <li>
      <Link
        href={`/hitters/${h.hitterId}`}
        className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-hairline bg-[var(--surface-0)] font-mono text-xs text-zinc-400">
          {h.lineupSlot ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate text-sm text-zinc-100 group-hover:text-oracle-green">
              {h.hitterName ?? 'Unknown'}
            </span>
            <SideBadge side={h.hitterHand} />
          </div>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {h.factors &&
              Object.entries(h.factors as FactorMap).map(([k, v]) => (
                <FactorPill key={k} label={k} signal={v} />
              ))}
          </div>
        </div>
        <div className="flex-shrink-0">
          <ProjectionTriple
            factorDk={h.dkPts}
            factorFd={h.fdPts}
            tunedDk={h.tunedDkPts}
            mlDk={h.mlDkPts}
            mlFd={h.mlFdPts}
            blendDk={h.blendDkPts}
            blendFd={h.blendFdPts}
          />
        </div>
      </Link>
    </li>
  );
}
