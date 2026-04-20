import Link from 'next/link';
import { Flame, Wind, MapPin } from 'lucide-react';
import {
  getPropsSlate,
  getTodayGameDates,
  getHitterSprayHits,
  type PropsRow,
} from '@/lib/db/queries';
import { SideBadge } from '@/components/side-badge';
import { TeamBadge } from '@/components/team-badge';
import { ParkOverlay, type SprayHit } from '@/components/park-overlay';
import { parkDimsForVenue } from '@/lib/park-dims';
import { PropsTabs } from './tabs';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ date?: string; tab?: string; preset?: string; pick?: string; sort?: string }>;

type PresetId = 'barrels' | 'weak-arm' | 'wind-out' | 'hr-parks' | 'pull-heavy' | 'hot';

const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: 'barrels',    label: 'BARRELS',    hint: 'barrel ≥ 10%' },
  { id: 'weak-arm',   label: 'WEAK ARM',   hint: 'HR/9 ≥ 1.3' },
  { id: 'wind-out',   label: 'WIND OUT',   hint: '≥ 10 mph out' },
  { id: 'hr-parks',   label: 'HR PARKS',   hint: 'factor ≥ 1.05' },
  { id: 'pull-heavy', label: 'PULL HEAVY', hint: 'pull ≥ 45%' },
  { id: 'hot',        label: 'HOT',        hint: '≥ 3 HR last 15' },
];

type SortId = 'prob' | 'xhr' | 'barrel' | 'l15' | 'hr9' | 'park';
const HR_SORTS: { id: SortId; label: string }[] = [
  { id: 'prob',   label: 'P(HR)' },
  { id: 'xhr',    label: 'xHR' },
  { id: 'barrel', label: 'BARREL' },
  { id: 'l15',    label: 'L15 HR' },
  { id: 'hr9',    label: 'HR/9' },
  { id: 'park',   label: 'PARK' },
];
const HITS_SORTS: { id: SortId; label: string }[] = [
  { id: 'prob',   label: 'P(1+)' },
  { id: 'xhr',    label: 'xH' },
];

function applyPreset(rows: PropsRow[], preset: PresetId | null): PropsRow[] {
  if (!preset) return rows;
  return rows.filter((r) => {
    if (preset === 'barrels')    return (r.barrelPct ?? 0) >= 0.10;
    if (preset === 'weak-arm')   return (r.pitcherHr9 ?? 0) >= 1.3;
    if (preset === 'wind-out')   return r.windOut;
    if (preset === 'hr-parks')   return (r.parkHrFactor ?? 0) >= 1.05;
    if (preset === 'pull-heavy') return (r.pullPct ?? 0) >= 0.45;
    if (preset === 'hot')        return (r.last15Hr ?? 0) >= 3;
    return true;
  });
}

function applySort(rows: PropsRow[], tab: 'hr' | 'hits', sort: SortId): PropsRow[] {
  const arr = [...rows];
  if (tab === 'hr') {
    if (sort === 'xhr')    return arr.sort((a, b) => (b.projHr ?? 0) - (a.projHr ?? 0));
    if (sort === 'barrel') return arr.sort((a, b) => (b.barrelPct ?? 0) - (a.barrelPct ?? 0));
    if (sort === 'l15')    return arr.sort((a, b) => (b.last15Hr ?? 0) - (a.last15Hr ?? 0));
    if (sort === 'hr9')    return arr.sort((a, b) => (b.pitcherHr9 ?? 0) - (a.pitcherHr9 ?? 0));
    if (sort === 'park')   return arr.sort((a, b) => (b.parkHrFactor ?? 0) - (a.parkHrFactor ?? 0));
    return arr.sort((a, b) => (b.pHr ?? 0) - (a.pHr ?? 0));
  }
  if (sort === 'xhr') return arr.sort((a, b) => (b.projH ?? 0) - (a.projH ?? 0));
  return arr.sort((a, b) => (b.pHit ?? 0) - (a.pHit ?? 0));
}

export default async function PropsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const availableDates = await getTodayGameDates();
  const date = params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);
  const tab: 'hr' | 'hits' = params.tab === 'hits' ? 'hits' : 'hr';
  const preset = (PRESETS.find((p) => p.id === params.preset)?.id ?? null) as PresetId | null;
  const sort = (['prob', 'xhr', 'barrel', 'l15', 'hr9', 'park'].includes(params.sort ?? '')
    ? params.sort
    : 'prob') as SortId;

  const allRows = await getPropsSlate(date);
  const filtered = applyPreset(allRows, preset);
  const sorted = applySort(filtered, tab, sort);

  // Featured: either user-picked or top of the sorted list
  const pickId = params.pick ? Number(params.pick) : null;
  const featured =
    (pickId != null ? sorted.find((r) => r.hitterId === pickId) : null) ??
    sorted[0] ??
    null;
  const featuredSpray: SprayHit[] = featured
    ? await getHitterSprayHits(featured.hitterId, 40)
    : [];

  return (
    <div className="min-h-screen">
      <Header
        date={date}
        availableDates={availableDates}
        tab={tab}
        preset={preset}
        sort={sort}
        propCount={sorted.length}
        totalCount={allRows.length}
      />
      <div className="px-6 pb-12 md:px-8">
        {allRows.length === 0 ? (
          <EmptyState />
        ) : sorted.length === 0 ? (
          <FilteredEmpty date={date} tab={tab} />
        ) : (
          <>
            {featured && (tab === 'hr' ? (
              <HrFeatured row={featured} spray={featuredSpray} />
            ) : (
              <HitsFeatured row={featured} spray={featuredSpray} />
            ))}
            {tab === 'hr' ? (
              <HrLeaderboard
                rows={sorted}
                pickedId={featured?.hitterId ?? null}
                date={date}
                tab={tab}
                preset={preset}
                sort={sort}
              />
            ) : (
              <HitsLeaderboard
                rows={sorted}
                pickedId={featured?.hitterId ?? null}
                date={date}
                tab={tab}
                preset={preset}
                sort={sort}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  date,
  availableDates,
  tab,
  preset,
  sort,
  propCount,
  totalCount,
}: {
  date: string;
  availableDates: string[];
  tab: 'hr' | 'hits';
  preset: PresetId | null;
  sort: SortId;
  propCount: number;
  totalCount: number;
}) {
  const sortOptions = tab === 'hr' ? HR_SORTS : HITS_SORTS;
  return (
    <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-5 pt-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-section">Props · Research</div>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
              {tab === 'hr' ? 'Home run props' : 'Hit props'}
            </h1>
            <PropsTabs current={tab} date={date} />
          </div>
          <div className="mt-2 flex items-center gap-3 font-mono text-xs text-zinc-500">
            <span>
              <span className="text-zinc-200">{propCount}</span>
              {preset && propCount !== totalCount && (
                <span className="text-zinc-600"> / {totalCount}</span>
              )}{' '}
              hitters
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              {new Date(date + 'T12:00:00').toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="text-zinc-700">·</span>
            <span>model only · no book odds</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase text-zinc-500">
          <span className="mr-1 text-zinc-600">recent:</span>
          {availableDates.slice(0, 8).map((d) => {
            const [, m, dd] = d.split('-');
            const active = d === date;
            const base = { tab, ...(preset ? { preset } : {}), sort };
            const qs = new URLSearchParams({ date: d, ...base }).toString();
            return (
              <Link
                key={d}
                href={`/props?${qs}`}
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

      {/* Sort + presets */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-md border border-hairline bg-[var(--surface-1)] p-0.5 font-mono text-[10px] uppercase tracking-widest">
          <span className="px-2 text-zinc-600">sort</span>
          {sortOptions.map((s) => {
            const qs = new URLSearchParams({
              date,
              tab,
              ...(preset ? { preset } : {}),
              sort: s.id,
            }).toString();
            const active = sort === s.id;
            return (
              <Link
                key={s.id}
                href={`/props?${qs}`}
                className={
                  'rounded px-2.5 py-1 transition ' +
                  (active
                    ? 'bg-oracle-green/15 text-oracle-green'
                    : 'text-zinc-500 hover:text-zinc-200')
                }
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
          presets
        </span>
        {PRESETS.map((p) => {
          const active = preset === p.id;
          const params = new URLSearchParams({ date, tab, sort });
          if (!active) params.set('preset', p.id);
          return (
            <Link
              key={p.id}
              href={`/props?${params.toString()}`}
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
            href={`/props?date=${date}&tab=${tab}&sort=${sort}`}
            className="font-mono text-[10px] text-zinc-500 hover:text-oracle-rose"
          >
            clear ×
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
      <div className="h-section">No props</div>
      <p className="max-w-md text-zinc-400">No projections for this date yet. Run the pipeline.</p>
    </div>
  );
}

function FilteredEmpty({ date, tab }: { date: string; tab: 'hr' | 'hits' }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline-strong p-16 text-center">
      <div className="h-section">No matches</div>
      <p className="max-w-md text-zinc-400">
        No hitters match the active preset.{' '}
        <Link href={`/props?date=${date}&tab=${tab}`} className="text-oracle-green hover:underline">
          Clear
        </Link>
        .
      </p>
    </div>
  );
}

function hrTone(factor: number | null) {
  if (factor == null) return 'neutral' as const;
  if (factor >= 1.05) return 'pos' as const;
  if (factor <= 0.95) return 'neg' as const;
  return 'neutral' as const;
}
function hr9Tone(hr9: number | null) {
  if (hr9 == null) return 'neutral' as const;
  if (hr9 >= 1.3) return 'warn' as const;
  if (hr9 <= 0.9) return 'neg' as const;
  return 'neutral' as const;
}
function pullTone(pct: number | null) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 0.45) return 'pos' as const;
  return 'neutral' as const;
}
function barrelTone(pct: number | null) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 0.12) return 'pos' as const;
  if (pct >= 0.08) return 'warn' as const;
  return 'neutral' as const;
}
function l15Tone(v: number | null) {
  if (v == null) return 'neutral' as const;
  if (v >= 3) return 'warn' as const;
  return 'neutral' as const;
}
function formTone(r: number | null) {
  if (r == null) return 'neutral' as const;
  if (r >= 1.1) return 'pos' as const;
  if (r <= 0.9) return 'neg' as const;
  return 'neutral' as const;
}
function fipTone(fip: number | null) {
  if (fip == null) return 'neutral' as const;
  if (fip >= 4.5) return 'pos' as const;
  if (fip <= 3.3) return 'neg' as const;
  return 'neutral' as const;
}
function toneClass(t: 'pos' | 'neg' | 'warn' | 'neutral') {
  return t === 'pos'
    ? 'text-oracle-green'
    : t === 'neg'
    ? 'text-oracle-rose'
    : t === 'warn'
    ? 'text-oracle-amber'
    : 'text-zinc-300';
}

function HrFeatured({ row, spray }: { row: PropsRow; spray: SprayHit[] }) {
  const weather = row.weather as { tempF?: number; windSpeedMph?: number; windDir?: string } | null;
  const dims = parkDimsForVenue(row.venueName);
  return (
    <div className="card-gradient mt-6 rounded-xl border border-hairline p-6">
      <div className="grid gap-6 md:grid-cols-[340px_1fr_2fr]">
        <div className="flex flex-col items-center">
          <div className="h-section self-start">Park · spray</div>
          <div className="mt-2">
            <ParkOverlay park={dims} hits={spray} hitterSide={row.hitterHand} size={320} featured />
          </div>
          <div className="mt-2 font-mono text-[10px] text-zinc-500">
            {row.venueName ?? 'TBD'} · {dims.L}-{dims.C}-{dims.R}ft
          </div>
        </div>
        <div>
          <div className="h-section">Pick of the day</div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-zinc-50">{row.hitterName ?? '—'}</h2>
            <SideBadge side={row.hitterHand} />
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500">
            {row.teamAbbrev && <TeamBadge abbrev={row.teamAbbrev} size="sm" />}
            {' '}
            vs {row.pitcherName ?? 'TBD'}
            {row.pitcherHand && <span className="text-zinc-600"> ({row.pitcherHand})</span>}
          </div>
          <div className="mt-4 flex items-end gap-6">
            <div>
              <div className="h-section">Model P(HR)</div>
              <div className="mt-0.5 font-mono text-4xl font-semibold text-oracle-amber">
                {row.pHr != null ? `${(row.pHr * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="h-section">xHR</div>
              <div className="mt-0.5 font-mono text-2xl text-zinc-200">
                {row.projHr != null ? row.projHr.toFixed(2) : '—'}
              </div>
            </div>
            <div>
              <div className="h-section">PA</div>
              <div className="mt-0.5 font-mono text-2xl text-zinc-200">
                {row.expectedPa != null ? row.expectedPa.toFixed(1) : '—'}
              </div>
            </div>
          </div>
          {(row.vsLHrPct != null || row.vsRHrPct != null) && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-hairline bg-[var(--surface-2)] p-3">
              <div>
                <div className="h-section">vs LHP HR%</div>
                <div className="mt-0.5 font-mono text-sm text-zinc-200">
                  {row.vsLHrPct != null ? `${(row.vsLHrPct * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="h-section">vs RHP HR%</div>
                <div className="mt-0.5 font-mono text-sm text-zinc-200">
                  {row.vsRHrPct != null ? `${(row.vsRHrPct * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="h-section">Why this pick</div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniCell
              label="Barrel"
              value={row.barrelPct != null ? `${(row.barrelPct * 100).toFixed(1)}%` : '—'}
              sub={row.avgExitVelo != null ? `EV ${row.avgExitVelo.toFixed(1)}` : ''}
              tone={barrelTone(row.barrelPct)}
            />
            <MiniCell
              label="L15 HR"
              value={row.last15Hr != null ? `${row.last15Hr}` : '—'}
              sub={row.pullPct != null ? `${Math.round(row.pullPct * 100)}% pull` : ''}
              tone={l15Tone(row.last15Hr)}
            />
            <MiniCell
              label="Pitcher"
              value={row.pitcherHr9 != null ? row.pitcherHr9.toFixed(2) : '—'}
              sub={`HR/9${row.pitcherFip != null ? ` · FIP ${row.pitcherFip.toFixed(2)}` : ''}`}
              tone={hr9Tone(row.pitcherHr9)}
            />
            <MiniCell
              label="Park"
              value={row.parkHrFactor != null ? row.parkHrFactor.toFixed(2) : '—'}
              sub={`HR factor${row.hitterHand ? ` · ${row.hitterHand === 'L' ? dims.R : dims.L}ft pull` : ''}`}
              tone={hrTone(row.parkHrFactor)}
            />
          </div>
          {weather && (weather.tempF || weather.windSpeedMph) && (
            <div className="mt-3 flex items-center gap-4 border-t border-hairline pt-3 font-mono text-[10px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {row.venueName ?? 'TBD'}
              </span>
              {weather.tempF != null && <span>{weather.tempF}°F</span>}
              {weather.windSpeedMph != null && weather.windSpeedMph > 0 && (
                <span className={'inline-flex items-center gap-1 ' + (row.windOut ? 'text-oracle-green' : '')}>
                  <Wind className="h-3 w-3" /> {weather.windSpeedMph} mph {weather.windDir ?? ''}
                  {row.windOut && <span className="font-semibold">· OUT</span>}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'pos' | 'neg' | 'warn' | 'neutral';
}) {
  return (
    <div className="rounded-md border border-hairline bg-[var(--surface-2)] px-3 py-2.5">
      <div className="h-section">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${toneClass(tone)}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function HrLeaderboard({
  rows,
  pickedId,
  date,
  tab,
  preset,
  sort,
}: {
  rows: PropsRow[];
  pickedId: number | null;
  date: string;
  tab: 'hr' | 'hits';
  preset: PresetId | null;
  sort: SortId;
}) {
  const cols = 'grid-cols-[2rem_minmax(10rem,1.7fr)_minmax(8rem,1.3fr)_4rem_4rem_4rem_4.5rem_4rem_4rem_4.5rem]';
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-[var(--surface-1)]">
      <div className="min-w-[690px]">
      <div className={`grid ${cols} items-center gap-3 border-b border-hairline px-4 py-2.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500`}>
        <div className="text-right">#</div>
        <div>Hitter</div>
        <div>Matchup</div>
        <div className="text-right">P(HR)</div>
        <div className="text-right">xHR</div>
        <div className="text-right">BARREL</div>
        <div className="text-right">L15 HR</div>
        <div className="text-right">PULL</div>
        <div className="text-right">HR/9</div>
        <div className="text-right">PARK</div>
      </div>
      {rows.map((r, i) => {
        const qs = new URLSearchParams({ date, tab, sort, pick: String(r.hitterId) });
        if (preset) qs.set('preset', preset);
        return (
          <Link
            key={`${r.hitterId}-${r.gamePk}`}
            href={`/props?${qs.toString()}`}
            className={`grid ${cols} items-center gap-3 border-b border-hairline px-4 py-2.5 text-sm hover:bg-[var(--surface-2)] ${pickedId === r.hitterId ? 'bg-[var(--surface-3)]' : ''}`}
          >
            <div className="text-right font-mono text-xs text-zinc-500">{i + 1}</div>
            <div className="flex items-center gap-2 min-w-0">
              <span className={'truncate ' + (pickedId === r.hitterId ? 'text-oracle-amber' : 'text-zinc-100')}>
                {r.hitterName ?? '—'}
              </span>
              <SideBadge side={r.hitterHand} />
              {r.teamAbbrev && (
                <span className="font-mono text-[10px] text-zinc-500">{r.teamAbbrev}</span>
              )}
            </div>
            <div className="min-w-0 truncate font-mono text-[11px] text-zinc-400">
              vs {r.pitcherName ?? 'TBD'}
              {r.pitcherHand && <span className="text-zinc-600"> ({r.pitcherHand})</span>}
            </div>
            <div className="text-right font-mono text-sm font-semibold text-oracle-amber">
              {r.pHr != null ? `${(r.pHr * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-right font-mono text-xs text-zinc-300">
              {r.projHr != null ? r.projHr.toFixed(2) : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(barrelTone(r.barrelPct))}`}>
              {r.barrelPct != null ? `${(r.barrelPct * 100).toFixed(1)}` : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(l15Tone(r.last15Hr))}`}>
              {r.last15Hr ?? '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(pullTone(r.pullPct))}`}>
              {r.pullPct != null ? Math.round(r.pullPct * 100) : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(hr9Tone(r.pitcherHr9))}`}>
              {r.pitcherHr9 != null ? r.pitcherHr9.toFixed(2) : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(hrTone(r.parkHrFactor))}`}>
              {r.parkHrFactor != null ? r.parkHrFactor.toFixed(2) : '—'}
            </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}

// ══════════════════════ HITS ════════════════════════════════════════

function stars(p: number | null) {
  if (p == null) return 0;
  if (p >= 0.78) return 5;
  if (p >= 0.68) return 4;
  if (p >= 0.58) return 3;
  if (p >= 0.48) return 2;
  return 1;
}

function HitsFeatured({ row, spray }: { row: PropsRow; spray: SprayHit[] }) {
  const tier = stars(row.pHit);
  const dims = parkDimsForVenue(row.venueName);
  return (
    <div className="card-gradient mt-6 rounded-xl border border-hairline p-6">
      <div className="grid gap-6 md:grid-cols-[340px_1fr_2fr]">
        <div className="flex flex-col items-center">
          <div className="h-section self-start">Park · spray</div>
          <div className="mt-2">
            <ParkOverlay park={dims} hits={spray} hitterSide={row.hitterHand} size={320} />
          </div>
          <div className="mt-2 font-mono text-[10px] text-zinc-500">
            {row.venueName ?? 'TBD'} · {dims.L}-{dims.C}-{dims.R}ft
          </div>
        </div>
        <div>
          <div className="h-section">Pick of the day</div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-zinc-50">{row.hitterName ?? '—'}</h2>
            <SideBadge side={row.hitterHand} />
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500">
            {row.teamAbbrev && <TeamBadge abbrev={row.teamAbbrev} size="sm" />}
            {' '}
            vs {row.pitcherName ?? 'TBD'}
            {row.pitcherHand && <span className="text-zinc-600"> ({row.pitcherHand})</span>}
          </div>
          <div className="mt-4 flex items-end gap-6">
            <div>
              <div className="h-section">P(1+ hit)</div>
              <div className="mt-0.5 font-mono text-4xl font-semibold text-oracle-green">
                {row.pHit != null ? `${(row.pHit * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="h-section">xH</div>
              <div className="mt-0.5 font-mono text-2xl text-zinc-200">
                {row.projH != null ? row.projH.toFixed(2) : '—'}
              </div>
            </div>
            <div>
              <div className="h-section">Tier</div>
              <div className="mt-0.5 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Flame
                    key={i}
                    className={`h-4 w-4 ${i < tier ? 'text-oracle-amber' : 'text-zinc-700'}`}
                    fill={i < tier ? 'currentColor' : 'transparent'}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="h-section">Why this pick</div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniCell
              label="P(2+ hits)"
              value={row.pTwoPlusHit != null ? `${(row.pTwoPlusHit * 100).toFixed(0)}%` : '—'}
              sub="multi-hit upside"
              tone={(row.pTwoPlusHit ?? 0) >= 0.35 ? 'pos' : 'neutral'}
            />
            <MiniCell
              label="PA proj"
              value={row.expectedPa != null ? row.expectedPa.toFixed(1) : '—'}
              sub={row.lineupSlot ? `lineup #${row.lineupSlot}` : ''}
              tone={(row.expectedPa ?? 0) >= 4.3 ? 'pos' : 'neutral'}
            />
            <MiniCell
              label="Form"
              value={row.formRatio != null ? row.formRatio.toFixed(2) : '—'}
              sub="last 30"
              tone={formTone(row.formRatio)}
            />
            <MiniCell
              label="Opp FIP"
              value={row.pitcherFip != null ? row.pitcherFip.toFixed(2) : '—'}
              sub={row.pitcherName ?? ''}
              tone={fipTone(row.pitcherFip)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HitsLeaderboard({
  rows,
  pickedId,
  date,
  tab,
  preset,
  sort,
}: {
  rows: PropsRow[];
  pickedId: number | null;
  date: string;
  tab: 'hr' | 'hits';
  preset: PresetId | null;
  sort: SortId;
}) {
  const cols = 'grid-cols-[2rem_minmax(10rem,1.7fr)_minmax(8rem,1.3fr)_4rem_4rem_4rem_4rem_4rem_4rem]';
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-[var(--surface-1)]">
      <div className="min-w-[650px]">
      <div className={`grid ${cols} items-center gap-3 border-b border-hairline px-4 py-2.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500`}>
        <div className="text-right">#</div>
        <div>Hitter</div>
        <div>Matchup</div>
        <div className="text-right">P(1+)</div>
        <div className="text-right">P(2+)</div>
        <div className="text-right">xH</div>
        <div className="text-right">PA</div>
        <div className="text-right">FORM</div>
        <div className="text-right">FIP</div>
      </div>
      {rows.map((r, i) => {
        const qs = new URLSearchParams({ date, tab, sort, pick: String(r.hitterId) });
        if (preset) qs.set('preset', preset);
        return (
          <Link
            key={`${r.hitterId}-${r.gamePk}`}
            href={`/props?${qs.toString()}`}
            className={`grid ${cols} items-center gap-3 border-b border-hairline px-4 py-2.5 text-sm hover:bg-[var(--surface-2)] ${pickedId === r.hitterId ? 'bg-[var(--surface-3)]' : ''}`}
          >
            <div className="text-right font-mono text-xs text-zinc-500">{i + 1}</div>
            <div className="flex items-center gap-2 min-w-0">
              <span className={'truncate ' + (pickedId === r.hitterId ? 'text-oracle-green' : 'text-zinc-100')}>
                {r.hitterName ?? '—'}
              </span>
              <SideBadge side={r.hitterHand} />
              {r.teamAbbrev && (
                <span className="font-mono text-[10px] text-zinc-500">{r.teamAbbrev}</span>
              )}
            </div>
            <div className="min-w-0 truncate font-mono text-[11px] text-zinc-400">
              vs {r.pitcherName ?? 'TBD'}
              {r.pitcherHand && <span className="text-zinc-600"> ({r.pitcherHand})</span>}
            </div>
            <div className="text-right font-mono text-sm font-semibold text-oracle-green">
              {r.pHit != null ? `${(r.pHit * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-right font-mono text-xs text-zinc-300">
              {r.pTwoPlusHit != null ? `${(r.pTwoPlusHit * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-right font-mono text-xs text-zinc-300">
              {r.projH != null ? r.projH.toFixed(2) : '—'}
            </div>
            <div className="text-right font-mono text-xs text-zinc-400">
              {r.expectedPa != null ? r.expectedPa.toFixed(1) : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(formTone(r.formRatio))}`}>
              {r.formRatio != null ? r.formRatio.toFixed(2) : '—'}
            </div>
            <div className={`text-right font-mono text-xs ${toneClass(fipTone(r.pitcherFip))}`}>
              {r.pitcherFip != null ? r.pitcherFip.toFixed(2) : '—'}
            </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}
