import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getPitcherDetail } from '@/lib/db/queries';
import { MetricTile } from '@/components/metric-tile';
import { SideBadge } from '@/components/side-badge';
import { SparkBar } from '@/components/spark-bar';

export const dynamic = 'force-dynamic';

export default async function PitcherPage({
  params,
}: {
  params: Promise<{ pitcherId: string }>;
}) {
  const { pitcherId } = await params;
  const pid = Number(pitcherId);
  const detail = await getPitcherDetail(pid);
  if (!detail) notFound();

  const { player, seasons, recentProj, reconciled } = detail;
  const currentSeason = seasons[0];
  const mae =
    reconciled.length > 0
      ? reconciled.reduce((s, r) => s + (r.abs_dk_error ?? 0), 0) / reconciled.length
      : null;

  return (
    <div className="min-h-screen">
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
            <div className="h-section">Pitcher</div>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
                {player.fullName}
              </h1>
              <SideBadge side={player.pitchHand} suffix="HP" />
            </div>
            <div className="mt-2 flex items-center gap-4 font-mono text-xs text-zinc-500">
              <span>id {player.playerId}</span>
              {currentSeason && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span>{currentSeason.starts} starts in {currentSeason.season}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Season averages */}
        {currentSeason && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
            <MetricTile label={`Starts · ${currentSeason.season}`}
                        value={currentSeason.starts.toString()} size="md" />
            <MetricTile label="Avg K / start"
                        value={currentSeason.avg_k?.toFixed(1) ?? '—'}
                        tone="green" size="md" />
            <MetricTile label="Avg BB / start"
                        value={currentSeason.avg_bb?.toFixed(1) ?? '—'} size="md" />
            <MetricTile label="Avg H allowed"
                        value={currentSeason.avg_h?.toFixed(1) ?? '—'} size="md" />
            <MetricTile label="Avg HR allowed"
                        value={currentSeason.avg_hr?.toFixed(2) ?? '—'} size="md" />
            <MetricTile label="Avg batters faced"
                        value={currentSeason.avg_bf?.toFixed(1) ?? '—'} size="md" />
          </div>
        )}

        {/* Track record */}
        <div className="mb-6 rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="h-section">Projection track record</div>
              <div className="mt-1 text-sm text-zinc-400">
                Last {reconciled.length} reconciled starts
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
          {reconciled.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="h-section">No reconciled starts yet</div>
              <p className="max-w-md text-center text-sm text-zinc-500">
                Projections get compared to actual starts nightly.
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
                    <th className="py-2 pr-3 text-right">IP</th>
                    <th className="py-2 pr-3 text-right">K</th>
                    <th className="py-2 pr-3 text-right">BB</th>
                    <th className="py-2 pr-3 text-right">Δ</th>
                    <th className="py-2">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciled.map((r, i) => {
                    const err = r.dk_error ?? 0;
                    const proj = r.proj_dk_pts ?? 0;
                    const act  = r.actual_dk_pts ?? 0;
                    const a = r.actual ?? {};
                    return (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-1.5 pr-3 text-zinc-400">{r.game_date.slice(5)}</td>
                        <td className="py-1.5 pr-3 text-right text-zinc-200">{proj.toFixed(1)}</td>
                        <td className="py-1.5 pr-3 text-right text-oracle-green">{act.toFixed(1)}</td>
                        <td className="py-1.5 pr-3 text-right text-zinc-400">{a.ip?.toFixed(1) ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-zinc-400">{a.k ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-zinc-400">{a.bb ?? '—'}</td>
                        <td className={
                          err > 1 ? 'py-1.5 pr-3 text-right text-oracle-green' :
                          err < -1 ? 'py-1.5 pr-3 text-right text-oracle-rose' :
                                     'py-1.5 pr-3 text-right text-zinc-500'
                        }>
                          {err > 0 ? '+' : ''}{err.toFixed(1)}
                        </td>
                        <td className="py-1.5"><SparkBar proj={proj} actual={act} maxBase={20} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming projections */}
        {recentProj.length > 0 && (
          <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
            <div className="h-section mb-3">Recent / upcoming projections</div>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">IP</th>
                  <th className="py-2 pr-3 text-right">K</th>
                  <th className="py-2 pr-3 text-right">Factor DK</th>
                  <th className="py-2 pr-3 text-right">ML DK</th>
                  <th className="py-2 pr-3 text-right">Factor FD</th>
                  <th className="py-2 pr-3 text-right">ML FD</th>
                </tr>
              </thead>
              <tbody>
                {recentProj.map((p, i) => {
                  const proj = p.proj as { ip?: number; k?: number } | null;
                  return (
                    <tr key={i} className="border-t border-hairline">
                      <td className="py-1.5 pr-3 text-zinc-400">
                        {String(p.gameDate).slice(5)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-zinc-300">{proj?.ip?.toFixed(1) ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-zinc-300">{proj?.k?.toFixed(1) ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-zinc-300">{p.dkPts?.toFixed(1) ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-oracle-green">{p.mlDkPts?.toFixed(1) ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-zinc-300">{p.fdPts?.toFixed(1) ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-oracle-green">{p.mlFdPts?.toFixed(1) ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
