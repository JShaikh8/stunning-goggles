import Link from 'next/link';
import { getCalibration, getCalibrationDateRange } from '@/lib/db/queries';
import { CalibrationScatter, MAELine } from '@/components/calibration-scatter';
import { MetricTile } from '@/components/metric-tile';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Flavor = 'baseline' | 'factor' | 'tuned' | 'ml' | 'blend';

const FLAVOR_META: Record<Flavor, { label: string; sub: string }> = {
  baseline: { label: 'Baseline',   sub: 'always predict mean actual' },
  factor:   { label: 'Factor',     sub: 'hand-tuned multipliers' },
  tuned:    { label: 'Tuned',      sub: 'factor + learned correction' },
  ml:       { label: 'ML',         sub: 'matchup classifier' },
  blend:    { label: 'Blend',      sub: '(tuned + ml) / 2' },
};

function daysAgo(end: string, n: number): string {
  const d = new Date(end + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const params = await searchParams;
  const bounds = await getCalibrationDateRange();
  const minD = bounds?.[0] ?? '2020-01-01';
  const maxD = bounds?.[1] ?? new Date().toISOString().slice(0, 10);

  const presets: { key: string; label: string; from: string; to: string }[] = [
    { key: 'all',   label: 'All time', from: minD, to: maxD },
    { key: 'last7', label: 'Last 7 days',  from: daysAgo(maxD, 7),  to: maxD },
    { key: 'last3', label: 'Last 3 days',  from: daysAgo(maxD, 3),  to: maxD },
    { key: 'today', label: maxD,           from: maxD,              to: maxD },
  ];

  // Default to all-time so the biggest sample shows
  const active =
    params.preset
      ? presets.find((p) => p.key === params.preset)
      : (params.from || params.to)
        ? { key: 'custom', label: 'Custom', from: params.from ?? minD, to: params.to ?? maxD }
        : presets[0];
  const from = active?.from ?? minD;
  const to   = active?.to   ?? maxD;

  const cal = await getCalibration(from, to);
  const bestMae = Math.min(
    cal.compare.factor.mae, cal.compare.tuned.mae,
    cal.compare.ml.mae,     cal.compare.blend.mae,
    cal.compare.baseline.mae,
  );

  const flavors: { key: Flavor; mae: number; bias: number }[] = [
    { key: 'baseline', ...cal.compare.baseline },
    { key: 'factor',   ...cal.compare.factor },
    { key: 'tuned',    ...cal.compare.tuned },
    { key: 'ml',       ...cal.compare.ml },
    { key: 'blend',    ...cal.compare.blend },
  ];

  return (
    <div className="min-h-screen">
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-8 md:px-8">
        <div className="h-section">Calibration</div>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-50">
          How accurate are we?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Nightly reconciliation joins each hitter-game projection to actual box scores.
          Every time games finalize, these metrics update. Lower MAE is better.
        </p>

        {/* Date range controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {presets.map((p) => {
              const isActive = active?.key === p.key;
              return (
                <Link
                  key={p.key}
                  href={`/calibration?preset=${p.key}`}
                  className={cn(
                    'rounded-md border px-3 py-1.5 font-mono text-xs transition',
                    isActive
                      ? 'border-oracle-green/40 bg-oracle-green/10 text-oracle-green'
                      : 'border-hairline bg-[var(--surface-1)] text-zinc-400 hover:border-hairline-strong hover:text-zinc-200',
                  )}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>

          {/* Custom range form */}
          <form
            method="get"
            action="/calibration"
            className="flex items-center gap-1.5 rounded-md border border-hairline bg-[var(--surface-1)] p-1 pr-2"
          >
            <input
              type="date"
              name="from"
              defaultValue={from}
              min={minD}
              max={maxD}
              className="bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none"
            />
            <span className="text-xs text-zinc-600">→</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              min={minD}
              max={maxD}
              className="bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded px-2 py-1 font-mono text-xs text-oracle-green hover:bg-oracle-green/10"
            >
              apply
            </button>
          </form>

          <div className="ml-auto font-mono text-[11px] text-zinc-500">
            Data range: <span className="text-zinc-300">{minD}</span> → <span className="text-zinc-300">{maxD}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Samples reconciled"
                      value={cal.count.toString()}
                      size="md" />
          <MetricTile label="Blend MAE"
                      value={cal.compare.blend.mae.toFixed(2)}
                      hint={`${((1 - cal.compare.blend.mae / cal.compare.baseline.mae) * 100).toFixed(1)}% below baseline`}
                      tone="green"
                      size="md" />
          <MetricTile label="Blend RMSE"
                      value={cal.rmse.toFixed(2)}
                      hint="penalizes big misses"
                      size="md" />
          <MetricTile label="Window"
                      value={`${from.slice(5)} — ${to.slice(5)}`}
                      hint={`${cal.byDate.length} days`}
                      size="sm" />
        </div>

        {cal.count === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Model comparison */}
            <div className="mb-6 rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <div>
                  <div className="h-section">Model comparison</div>
                  <p className="mt-1 text-sm text-zinc-500">
                    Best single number = <span className="text-oracle-green font-medium">Blend</span>.
                    Combines the bias-corrected factor with the ML matchup classifier.
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  <div>Mean actual DK</div>
                  <div className="mt-0.5 text-base text-zinc-200">
                    {cal.compare.meanActual.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                {flavors.map(({ key, mae, bias }) => {
                  const meta = FLAVOR_META[key];
                  const isBest = Math.abs(mae - bestMae) < 0.001;
                  const vsBaseline =
                    cal.compare.baseline.mae > 0
                      ? (mae / cal.compare.baseline.mae - 1) * 100
                      : 0;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'rounded-lg border p-4 transition',
                        isBest
                          ? 'border-oracle-green/50 bg-oracle-green/10'
                          : 'border-hairline bg-[var(--surface-0)]',
                      )}
                    >
                      <div className="flex items-baseline justify-between">
                        <div className="h-section">{meta.label}</div>
                        {isBest && (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-oracle-green">
                            best
                          </span>
                        )}
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                        {mae.toFixed(2)}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">
                        bias <span className={
                          Math.abs(bias) < 0.2 ? 'text-zinc-300' :
                          bias > 0 ? 'text-oracle-rose' : 'text-oracle-sky'
                        }>{bias > 0 ? '+' : ''}{bias.toFixed(2)}</span>
                        {key !== 'baseline' && (
                          <>
                            {' '}· vs base{' '}
                            <span className={vsBaseline < 0 ? 'text-oracle-green' : 'text-oracle-rose'}>
                              {vsBaseline > 0 ? '+' : ''}{vsBaseline.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 font-mono text-[10px] text-zinc-600">
                        {meta.sub}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
                <div className="h-section mb-2">Projected vs actual · blend</div>
                <div className="mb-3 text-xs text-zinc-500">
                  Each dot is one hitter-game. Dashed line is a perfect projection.
                </div>
                <CalibrationScatter rows={cal.rows} />
              </div>
              <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-5">
                <div className="h-section mb-2">Daily blend MAE</div>
                <div className="mb-3 text-xs text-zinc-500">
                  Spikes usually mean a chaotic slate (bullpen games, early doubles).
                </div>
                <MAELine rows={cal.byDate} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
      <div className="h-section">No reconciled data in this range</div>
      <p className="max-w-md text-zinc-400">
        Try picking a wider window or the &quot;All time&quot; preset.
      </p>
    </div>
  );
}
