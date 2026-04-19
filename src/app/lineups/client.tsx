'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Download, Upload, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricTile } from '@/components/metric-tile';
import { TeamBadge } from '@/components/team-badge';
import { optimizeLineups, type Lineup, type PlayerOption } from '@/lib/optimizer';
import type { DfsPoolRow } from '@/lib/db/queries';

export function LineupsClient({
  initialDate,
  availableDates,
  initialPool,
}: {
  initialDate: string;
  availableDates: string[];
  initialPool: DfsPoolRow[];
}) {
  const router = useRouter();
  const [pool, setPool] = useState(initialPool);
  const [date, setDate] = useState(initialDate);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState<'blend' | 'ml' | 'factor' | 'fppg'>('blend');
  const [topN, setTopN] = useState(10);

  // Transform the pool into optimizer input using the selected projection source
  const options: PlayerOption[] = useMemo(() => {
    return pool.map((r) => {
      const proj =
        source === 'blend'  ? (r.blend_fd_pts ?? r.ml_fd_pts ?? r.factor_fd_pts ?? r.fppg ?? 0) :
        source === 'ml'     ? (r.ml_fd_pts ?? r.factor_fd_pts ?? r.fppg ?? 0) :
        source === 'factor' ? (r.factor_fd_pts ?? r.fppg ?? 0) :
                              (r.fppg ?? 0);
      return {
        fdPlayerId: r.fd_player_id,
        name: r.fd_name,
        position: r.position,
        salary: r.salary,
        projectedPoints: proj,
        team: r.team,
        opponent: r.opponent,
        game: r.game,
        battingOrder: r.batting_order,
        matchedPlayerId: r.matched_player_id,
        injuryIndicator: r.injury_indicator,
      };
    });
  }, [pool, source]);

  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [running, setRunning] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  function generate() {
    setRunning(true);
    // Yield to event loop so the UI can repaint
    setTimeout(() => {
      const result = optimizeLineups(options, { topN });
      setLineups(result);
      setActiveIdx(0);
      setRunning(false);
    }, 30);
  }

  async function handleUpload(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('date', date);
    setUploadMsg('Uploading…');
    const res = await fetch('/api/fd-slate/upload', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      setUploadMsg(`Error: ${err.error ?? 'upload failed'}`);
      return;
    }
    const data: {
      slateDate: string; count: number; matched: number; totalUnmatched: number;
    } = await res.json();
    setUploadMsg(
      `Uploaded ${data.count} players for ${data.slateDate}. ` +
      `Matched ${data.matched} to our projections (${data.totalUnmatched} unmatched).`,
    );
    startTransition(() => {
      router.push(`/lineups?date=${data.slateDate}`);
      router.refresh();
    });
  }

  const totalPool = pool.length;
  const matchedPool = pool.filter((r) => r.matched_player_id != null).length;
  const withProj = options.filter((o) => o.projectedPoints > 0).length;

  return (
    <div className="min-h-screen">
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="h-section">Lineups</div>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-50">
              FanDuel DFS optimizer
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Upload today&apos;s FanDuel CSV. We match each player to our projections
              and run an optimizer for the top {topN} unique lineups under the
              $35,000 salary cap with positional + team constraints.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase text-zinc-500">
            <span className="mr-1 text-zinc-600">slates:</span>
            {availableDates.slice(0, 8).map((d) => {
              const [, m, dd] = d.split('-');
              const active = d === date;
              return (
                <Link
                  key={d}
                  href={`/lineups?date=${d}`}
                  className={cn(
                    'rounded px-2 py-1',
                    active ? 'bg-oracle-green/15 text-oracle-green' : 'text-zinc-500 hover:bg-[var(--surface-2)] hover:text-zinc-200',
                  )}
                >
                  {m}/{dd}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Upload zone */}
        <UploadZone
          onUpload={handleUpload}
          message={uploadMsg}
          date={date}
          setDate={setDate}
          isPending={isPending}
        />

        {/* Pool summary */}
        <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Players in pool" value={totalPool.toString()} size="md" />
          <MetricTile label="Matched to projections" value={matchedPool.toString()}
                      tone={matchedPool > 0 ? 'green' : 'neutral'} size="md" />
          <MetricTile label="With projection" value={withProj.toString()} size="md" />
          <MetricTile label="Salary cap" value="$35,000" size="sm" />
        </div>

        {/* Optimizer controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-[var(--surface-1)] p-4">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-zinc-500">PROJECTION</span>
            {(['blend', 'ml', 'factor', 'fppg'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={cn(
                  'rounded-md border px-3 py-1 uppercase tracking-widest text-[10px]',
                  source === s
                    ? 'border-oracle-green/40 bg-oracle-green/10 text-oracle-green'
                    : 'border-hairline bg-[var(--surface-0)] text-zinc-500 hover:text-zinc-200',
                )}
              >
                {s === 'fppg' ? 'FD FPPG' : s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-zinc-500">COUNT</span>
            <input
              type="number"
              value={topN}
              min={1}
              max={50}
              onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value))))}
              className="w-16 rounded-md border border-hairline bg-[var(--surface-0)] px-2 py-1 text-zinc-200 focus:border-oracle-green/50 focus:outline-none"
            />
          </div>
          <button
            onClick={generate}
            disabled={running || options.length === 0}
            className="ml-auto rounded-md bg-oracle-green/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-oracle-green hover:bg-oracle-green/25 disabled:opacity-40"
          >
            {running ? 'Optimizing…' : `Generate ${topN} lineups`}
          </button>
        </div>

        {/* Lineups */}
        {lineups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline-strong p-12 text-center">
            <div className="h-section">No lineups generated yet</div>
            <p className="mt-2 text-sm text-zinc-500">
              Upload a slate, choose a projection source, then click <span className="text-zinc-300">Generate</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <LineupSummaryList
              lineups={lineups}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />
            <LineupDetail lineup={lineups[activeIdx]} />
          </div>
        )}
      </div>
    </div>
  );
}


function UploadZone({
  onUpload,
  message,
  date,
  setDate,
  isPending,
}: {
  onUpload: (file: File) => void;
  message: string | null;
  date: string;
  setDate: (d: string) => void;
  isPending: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="rounded-xl border border-hairline bg-[var(--surface-1)] p-4">
      <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="h-section">Upload FanDuel slate CSV</div>
          <p className="mt-1 text-xs text-zinc-500">
            Download the template from FanDuel&apos;s DFS page, then drop it here. We handle the 10-row preamble automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Slate date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-hairline bg-[var(--surface-0)] px-2 py-1 font-mono text-xs text-zinc-200 focus:border-oracle-green/50 focus:outline-none"
          />
        </label>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition',
          dragging
            ? 'border-oracle-green/60 bg-oracle-green/5'
            : 'border-hairline hover:border-hairline-strong bg-[var(--surface-0)]/30',
        )}
      >
        <Upload className="h-6 w-6 text-zinc-500" />
        <div className="text-sm text-zinc-400">
          Drop CSV here, or{' '}
          <label className="cursor-pointer text-oracle-green hover:underline">
            browse
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
          fanduel-mlb-{date}-lineup-upload-template.csv
        </p>
      </div>

      {message && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-hairline bg-[var(--surface-0)]/40 px-3 py-2 font-mono text-xs text-zinc-300">
          <Check className="h-3.5 w-3.5 text-oracle-green" />
          {message}
          {isPending && <span className="text-zinc-500">· refreshing…</span>}
        </div>
      )}
    </div>
  );
}


function LineupSummaryList({
  lineups,
  activeIdx,
  setActiveIdx,
}: {
  lineups: Lineup[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
}) {
  return (
    <div className="flex max-h-[70vh] flex-col overflow-y-auto rounded-xl border border-hairline bg-[var(--surface-1)]">
      <div className="sticky top-0 border-b border-hairline bg-[var(--surface-1)] px-4 py-2.5">
        <div className="h-section">Top {lineups.length} lineups</div>
      </div>
      <ul>
        {lineups.map((l, i) => (
          <li key={i}>
            <button
              onClick={() => setActiveIdx(i)}
              className={cn(
                'flex w-full items-center justify-between gap-3 border-b border-hairline/60 px-4 py-3 text-left transition',
                i === activeIdx ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]/50',
              )}
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  #{i + 1}
                </div>
                <div className="font-mono text-lg font-semibold text-oracle-green">
                  {l.projected.toFixed(1)}
                </div>
              </div>
              <div className="text-right font-mono text-[10px] text-zinc-500">
                <div>${l.salary.toLocaleString()}</div>
                <div>{Object.keys(l.teams).length} tm · {l.games.size} gm</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


function LineupDetail({ lineup }: { lineup: Lineup }) {
  const rows: [string, PlayerOption][] = [
    ['P',     lineup.P],
    ['C/1B',  lineup.C1B],
    ['2B',    lineup._2B],
    ['3B',    lineup._3B],
    ['SS',    lineup.SS],
    ['OF',    lineup.OF[0]],
    ['OF',    lineup.OF[1]],
    ['OF',    lineup.OF[2]],
    ['UTIL',  lineup.UTIL],
  ];

  const exportCsv = () => {
    const header = 'P,C/1B,2B,3B,SS,OF,OF,OF,UTIL';
    const line = [
      `${lineup.P.fdPlayerId}:${lineup.P.name}`,
      `${lineup.C1B.fdPlayerId}:${lineup.C1B.name}`,
      `${lineup._2B.fdPlayerId}:${lineup._2B.name}`,
      `${lineup._3B.fdPlayerId}:${lineup._3B.name}`,
      `${lineup.SS.fdPlayerId}:${lineup.SS.name}`,
      `${lineup.OF[0].fdPlayerId}:${lineup.OF[0].name}`,
      `${lineup.OF[1].fdPlayerId}:${lineup.OF[1].name}`,
      `${lineup.OF[2].fdPlayerId}:${lineup.OF[2].name}`,
      `${lineup.UTIL.fdPlayerId}:${lineup.UTIL.name}`,
    ].map((s) => `"${s}"`).join(',');
    const blob = new Blob([header + '\n' + line], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fd-lineup.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-hairline bg-[var(--surface-1)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-4">
        <div>
          <div className="h-section">Lineup detail</div>
          <div className="mt-1 flex items-center gap-3 font-mono text-sm">
            <span className="text-oracle-green text-2xl font-bold">{lineup.projected.toFixed(1)}</span>
            <span className="text-zinc-500">FD pts</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-300">${lineup.salary.toLocaleString()}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-300">${(lineup.salary / 9).toFixed(0)} avg</span>
          </div>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-[var(--surface-3)]"
        >
          <Download className="h-3 w-3" />
          Export FD CSV
        </button>
      </div>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-hairline text-zinc-500">
            <th className="px-3 py-2 text-left uppercase tracking-widest text-[10px]">Slot</th>
            <th className="px-3 py-2 text-left uppercase tracking-widest text-[10px]">Player</th>
            <th className="px-3 py-2 text-left uppercase tracking-widest text-[10px]">Tm</th>
            <th className="px-3 py-2 text-left uppercase tracking-widest text-[10px]">Game</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">BO</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">Salary</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">Proj</th>
            <th className="px-3 py-2 text-right uppercase tracking-widest text-[10px]">$/pt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([slot, p], i) => (
            <tr key={i} className="border-b border-hairline/60 last:border-0 hover:bg-[var(--surface-2)]">
              <td className="px-3 py-2 text-zinc-500">{slot}</td>
              <td className="px-3 py-2">
                {p.matchedPlayerId ? (
                  <Link
                    href={slot === 'P' ? `/pitchers/${p.matchedPlayerId}` : `/hitters/${p.matchedPlayerId}`}
                    className="text-zinc-100 hover:text-oracle-green"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="text-zinc-100">{p.name}</span>
                )}
              </td>
              <td className="px-3 py-2"><TeamBadge abbrev={p.team} size="sm" /></td>
              <td className="px-3 py-2 text-zinc-400">{p.game}</td>
              <td className="px-3 py-2 text-right text-zinc-400">
                {p.battingOrder ?? '—'}
              </td>
              <td className="px-3 py-2 text-right text-zinc-300">
                ${p.salary.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-oracle-green">
                {p.projectedPoints.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-right text-zinc-500">
                ${(p.salary / Math.max(p.projectedPoints, 0.1)).toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
