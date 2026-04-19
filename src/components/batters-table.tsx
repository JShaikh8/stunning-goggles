'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FactorPill } from '@/components/factor-pill';
import { TeamBadge } from '@/components/team-badge';
import { SideBadge } from '@/components/side-badge';
import type { FactorMap, HitterProjBlob } from '@/lib/db/schema';

type Row = {
  hitterId: number | null;
  gamePk: number | null;
  hitterName: string | null;
  hitterHand: string | null;
  pitcherId: number | null;
  pitcherName: string | null;
  team: string | null;
  opp: string | null;
  side: string | null;
  lineupSlot: number | null;
  dkPts: number | null;
  fdPts: number | null;
  tunedDkPts: number | null;
  mlDkPts: number | null;
  mlFdPts: number | null;
  mlDelta: number | null;
  blendDkPts: number | null;
  blendFdPts: number | null;
  factors: FactorMap | null;
  factorScore: number | null;
  proj: HitterProjBlob | null;
  expectedPa: number | null;
  seasonDkAvg?: number | null;
  seasonFdAvg?: number | null;
  seasonGames?: number;
};

type SortKey =
  | 'blendFdPts' | 'blendDkPts'
  | 'fdPts' | 'mlFdPts'
  | 'mlDelta' | 'factorScore' | 'lineupSlot' | 'hitterName' | 'team'
  | 'seasonFdAvg';

const HEADERS: { key: SortKey; label: string; align?: 'right'; primary?: boolean }[] = [
  { key: 'hitterName',  label: 'Hitter' },
  { key: 'team',        label: 'Team' },
  { key: 'lineupSlot',  label: 'Slot', align: 'right' },
  { key: 'seasonFdAvg', label: 'Season FD', align: 'right' },
  { key: 'blendFdPts',  label: 'Proj FD',  align: 'right', primary: true },
  { key: 'blendDkPts',  label: 'Proj DK',  align: 'right', primary: true },
  { key: 'fdPts',       label: 'Factor FD', align: 'right' },
  { key: 'mlFdPts',     label: 'ML FD',    align: 'right' },
  { key: 'mlDelta',     label: 'Δ',      align: 'right' },
  { key: 'factorScore', label: 'Score',  align: 'right' },
];

export function BattersTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('blendFdPts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.hitterName?.toLowerCase().includes(q) ||
        r.team?.toLowerCase().includes(q) ||
        r.opp?.toLowerCase().includes(q) ||
        r.pitcherName?.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir(k === 'hitterName' || k === 'team' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hitter, team, pitcher…"
            className="w-full rounded-md border border-hairline bg-[var(--surface-1)] py-2 pl-9 pr-3 font-mono text-xs placeholder:text-zinc-600 focus:border-oracle-green/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <ArrowDownUp className="h-3 w-3" />
          <span>sort by any column</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline bg-[var(--surface-1)]">
        <table className="min-w-full text-xs font-mono">
          <thead className="sticky top-0 z-10 bg-[var(--surface-1)]/95 backdrop-blur">
            <tr className="border-b border-hairline-strong">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className={cn(
                    'cursor-pointer select-none px-3 py-2.5 uppercase tracking-widest text-[10px]',
                    h.align === 'right' ? 'text-right' : 'text-left',
                    h.primary ? 'text-oracle-green' : 'text-zinc-500',
                    sortKey === h.key ? 'text-zinc-100' : '',
                  )}
                >
                  {h.label}
                  {sortKey === h.key && (
                    <span className="ml-1 text-[8px] opacity-70">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                Factors
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                vs
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length + 2} className="py-12 text-center text-zinc-600">
                  No hitters match your filter.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const divergent = r.mlDelta != null && Math.abs(r.mlDelta) >= 2;
                const up = (r.mlDelta ?? 0) > 0;
                return (
                  <tr
                    key={`${r.hitterId}-${r.gamePk}`}
                    className="border-b border-hairline/60 last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={r.hitterId ? `/hitters/${r.hitterId}` : '#'}
                        className="inline-flex items-center gap-1.5 text-zinc-100 hover:text-oracle-green"
                      >
                        {r.hitterName ?? '—'}
                        <SideBadge side={r.hitterHand} />
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <TeamBadge abbrev={r.team} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {r.lineupSlot ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-zinc-200">
                        {r.seasonFdAvg != null ? r.seasonFdAvg.toFixed(1) : '—'}
                      </span>
                      {r.seasonGames ? (
                        <span className="ml-1 text-[9px] text-zinc-600">
                          ({r.seasonGames}g)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-oracle-green font-semibold">
                      {r.blendFdPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-oracle-green/70">
                      {r.blendDkPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {r.fdPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {r.mlFdPts?.toFixed(1) ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right',
                        !divergent ? 'text-zinc-500' :
                        up ? 'text-oracle-green' : 'text-oracle-rose',
                      )}
                    >
                      {r.mlDelta != null
                        ? (up ? '+' : '') + r.mlDelta.toFixed(1)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {r.factorScore != null
                        ? (r.factorScore > 0 ? '+' : '') + r.factorScore.toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-0.5">
                        {r.factors &&
                          Object.entries(r.factors).map(([k, v]) => (
                            <FactorPill key={k} label={k} signal={v} />
                          ))}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.gamePk != null ? (
                        <Link
                          href={`/games/${r.gamePk}`}
                          className="inline-flex items-center gap-1.5 hover:text-oracle-green"
                        >
                          <TeamBadge abbrev={r.opp} size="sm" />
                          <span className="truncate text-[11px] text-zinc-400">
                            {r.pitcherName ?? ''}
                          </span>
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        showing {sorted.length} / {rows.length} rows
      </div>
    </div>
  );
}
