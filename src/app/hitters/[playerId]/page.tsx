import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Flame, Snowflake } from 'lucide-react';
import {
  getHitterDetail,
  getHitterSeasonStats,
  getHitterRecentReconciliation,
} from '@/lib/db/queries';
import { FactorRadar } from '@/components/factor-radar';
import { SprayChart } from '@/components/spray-chart';
import { MetricTile } from '@/components/metric-tile';
import { SideBadge } from '@/components/side-badge';
import { SparkBar } from '@/components/spark-bar';
import type { FactorMap } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export default async function HitterPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const hid = Number(playerId);
  const detail = await getHitterDetail(hid);
  if (!detail) notFound();

  const currentSeason = new Date().getUTCFullYear();
  const [seasonStats, recentReconciled] = await Promise.all([
    getHitterSeasonStats(hid, currentSeason),
    getHitterRecentReconciliation(hid),
  ]);

  const { player, form, spray, similar, splits, recentProjections, sprayHits } = detail;

  const latestFactors =
    (recentProjections[0]?.factors as FactorMap | null) ??
    ({
      park: 0, weather: 0, platoon: 0,
      stuffQuality: 0, recentForm: 0, battingOrder: 0, matchup: 0,
    } as FactorMap);

  const mae =
    recentReconciled.length > 0
      ? recentReconciled.reduce((s, r) => s + (r.absDkError ?? 0), 0) /
        recentReconciled.length
      : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-6 md:px-8">
        <Link
          href="/players"
          className="group mb-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" />
          back to players
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="h-section">Hitter</div>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
                {player.fullName}
              </h1>
              <SideBadge side={player.batSide} />
            </div>
            <div className="mt-2 flex items-center gap-4 font-mono text-xs text-zinc-500">
              <span>id {player.playerId}</span>
              <span className="text-zinc-700">·</span>
              <span>{player.primaryPosition ?? 'Position unknown'}</span>
            </div>
          </div>
          {form && (
            <FormPill form={form} />
          )}
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Stat row */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <MetricTile
            label={`DK / game · ${currentSeason}`}
            value={seasonStats.seasonDkAvg != null ? seasonStats.seasonDkAvg.toFixed(1) : '—'}
            hint={seasonStats.seasonGames ? `${seasonStats.seasonGames} games` : 'no games yet'}
            size="md"
          />
          <MetricTile
            label={`FD / game · ${currentSeason}`}
            value={seasonStats.seasonFdAvg != null ? seasonStats.seasonFdAvg.toFixed(1) : '—'}
            size="md"
          />
          <MetricTile
            label="Last 15 DK"
            value={seasonStats.last15DkAvg != null ? seasonStats.last15DkAvg.toFixed(1) : '—'}
            hint={seasonStats.last15Games ? `${seasonStats.last15Games} games` : undefined}
            tone="green"
            size="md"
          />
          <MetricTile
            label="Season AVG"
            value={seasonStats.seasonAvg != null ? seasonStats.seasonAvg.toFixed(3) : '—'}
            size="md"
          />
          <MetricTile
            label="Season SLG"
            value={seasonStats.seasonSlg != null ? seasonStats.seasonSlg.toFixed(3) : '—'}
            size="md"
          />
          <MetricTile
            label="Spray pull %"
            value={spray?.pullPct ? `${(spray.pullPct * 100).toFixed(0)}%` : '—'}
            hint={spray?.avgExitVelo ? `EV ${spray.avgExitVelo.toFixed(1)}` : undefined}
            size="md"
          />
        </div>

        {/* Track record */}
        <div className="mb-6 rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="h-section">Projection track record</div>
              <div className="mt-1 text-sm text-zinc-400">
                Last {recentReconciled.length} reconciled games
              </div>
            </div>
            {mae != null && (
              <div className="text-right">
                <div className="h-section">MAE</div>
                <div className="mt-1 font-mono text-xl text-zinc-100">
                  {mae.toFixed(2)}
                  <span className="ml-1 text-xs text-zinc-500">DK pts</span>
                </div>
              </div>
            )}
          </div>

          {recentReconciled.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="h-section">No reconciliations yet</div>
              <p className="max-w-md text-center text-sm text-zinc-500">
                Projections get compared to actual box scores nightly. Check back after today&apos;s games finalize.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3 text-right">Proj DK</th>
                    <th className="py-2 pr-3 text-right">Actual</th>
                    <th className="py-2 pr-3 text-right">Δ</th>
                    <th className="py-2">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReconciled.map((r, i) => {
                    const err = r.dkError ?? 0;
                    const proj = r.projDkPts ?? 0;
                    const act  = r.actualDkPts ?? 0;
                    return (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-1.5 pr-3 text-zinc-400">
                          {String(r.gameDate).slice(5)}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-zinc-200">
                          {proj.toFixed(1)}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-oracle-green">
                          {act.toFixed(1)}
                        </td>
                        <td
                          className={
                            err > 1
                              ? 'py-1.5 pr-3 text-right text-oracle-green'
                              : err < -1
                                ? 'py-1.5 pr-3 text-right text-oracle-rose'
                                : 'py-1.5 pr-3 text-right text-zinc-500'
                          }
                        >
                          {err > 0 ? '+' : ''}{err.toFixed(1)}
                        </td>
                        <td className="py-1.5">
                          <SparkBar proj={proj} actual={act} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Radar + Spray side-by-side on large screens */}
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[400px_1fr]">
          <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
            <div className="h-section mb-2">Latest factor breakdown</div>
            <FactorRadar factors={latestFactors} />
          </div>
          <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
            <div className="h-section mb-2">Spray chart · last {sprayHits.length} BIP</div>
            {sprayHits.length > 0 ? (
              <SprayChart hits={sprayHits} />
            ) : (
              <div className="flex h-64 items-center justify-center text-zinc-600">
                No batted-ball data
              </div>
            )}
          </div>
        </div>

        {/* Splits + Similar hitters */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
            <div className="h-section mb-3">Pitch-family splits · {splits.length} rows</div>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1 pr-2">Family</th>
                  <th className="py-1 pr-2">Season</th>
                  <th className="py-1 pr-2 text-right">PA</th>
                  <th className="py-1 pr-2 text-right">AVG</th>
                  <th className="py-1 pr-2 text-right">SLG</th>
                  <th className="py-1 text-right">Whiff</th>
                </tr>
              </thead>
              <tbody>
                {splits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-600">No splits data</td>
                  </tr>
                ) : splits.slice(0, 24).map((s) => (
                  <tr key={`${s.pitchFamily}-${s.season}`} className="border-t border-hairline/50">
                    <td className="py-1 pr-2 text-zinc-200">{s.pitchFamily}</td>
                    <td className="py-1 pr-2 text-zinc-400">{s.season}</td>
                    <td className="py-1 pr-2 text-right text-zinc-400">{s.pa}</td>
                    <td className="py-1 pr-2 text-right text-zinc-200">{s.avg?.toFixed(3)}</td>
                    <td className="py-1 pr-2 text-right text-zinc-200">{s.slg?.toFixed(3)}</td>
                    <td className="py-1 text-right text-zinc-400">
                      {s.whiffPct != null ? `${(s.whiffPct * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
            <div className="h-section mb-3">Similar hitters · archetype cosine</div>
            {similar?.similarList?.length ? (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {similar.similarList.slice(0, 12).map((s, idx) => (
                  <li key={idx}>
                    <Link
                      href={`/hitters/${s.hitter_id}`}
                      className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-[var(--surface-2)]"
                    >
                      <span className="truncate text-zinc-200 hover:text-oracle-green">
                        {s.hitter_name}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {s.similarity.toFixed(3)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-zinc-600">No archetype computed yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormPill({ form }: { form: { formSignal: string | null; formRatio: number | null } }) {
  const hot  = form.formSignal === 'hot';
  const cold = form.formSignal === 'cold';
  const Icon = hot ? Flame : cold ? Snowflake : null;
  const tone = hot
    ? 'bg-oracle-amber/10 text-oracle-amber border-oracle-amber/30'
    : cold
      ? 'bg-oracle-sky/10 text-oracle-sky border-oracle-sky/30'
      : 'bg-zinc-800/60 text-zinc-400 border-hairline';
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="font-mono text-xs uppercase tracking-widest">
          {form.formSignal ?? 'normal'}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10px] opacity-70">
        form ratio {form.formRatio?.toFixed(2) ?? '—'}
      </div>
    </div>
  );
}
