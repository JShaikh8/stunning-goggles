'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeamBadge } from '@/components/team-badge';
import { SideBadge } from '@/components/side-badge';
import type { PitcherProjBlob } from '@/lib/db/schema';

type Row = {
  pitcherId: number | null;
  gamePk: number | null;
  pitcherName: string | null;
  pitcherHand: string | null;
  team: string | null | undefined;
  opp: string | null | undefined;
  side: string | null;
  dkPts: number | null;
  fdPts: number | null;
  mlDkPts: number | null;
  mlFdPts: number | null;
  mlDelta: number | null;
  fip: number | null;
  gamesStarted: number | null;
  proj: PitcherProjBlob | null;
};

type SortKey =
  | 'fdPts' | 'dkPts' | 'mlFdPts' | 'mlDkPts'
  | 'mlDelta' | 'fip' | 'pitcherName' | 'team';

const HEADERS: { key: SortKey; label: string; align?: 'right'; group?: 'proj' | 'ml' }[] = [
  { key: 'pitcherName', label: 'Pitcher' },
  { key: 'team',        label: 'Team' },
  { key: 'fip',         label: 'FIP', align: 'right' },
  { key: 'fdPts',       label: 'Factor FD', align: 'right', group: 'proj' },
  { key: 'dkPts',       label: 'Factor DK', align: 'right', group: 'proj' },
  { key: 'mlFdPts',     label: 'ML FD', align: 'right', group: 'ml' },
  { key: 'mlDkPts',     label: 'ML DK', align: 'right', group: 'ml' },
  { key: 'mlDelta',     label: 'Δ', align: 'right' },
];

export function PitchersTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('fdPts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.pitcherName?.toLowerCase().includes(q) ||
        r.team?.toLowerCase().includes(q) ||
        r.opp?.toLowerCase().includes(q),
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
      setSortDir(k === 'pitcherName' || k === 'team' ? 'asc' : 'desc');
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
            placeholder="Search pitcher, team, opponent…"
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
                    h.group === 'ml' ? 'text-oracle-green/80' :
                    h.group === 'proj' ? 'text-zinc-300' : 'text-zinc-500',
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
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-zinc-500">IP</th>
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-zinc-500">K</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-zinc-500">vs</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length + 3} className="py-12 text-center text-zinc-600">
                  No pitchers match your filter.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const divergent = r.mlDelta != null && Math.abs(r.mlDelta) >= 2;
                const up = (r.mlDelta ?? 0) > 0;
                const proj = (r.proj ?? {}) as PitcherProjBlob;
                return (
                  <tr
                    key={`${r.pitcherId}-${r.gamePk}`}
                    className="border-b border-hairline/60 last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={r.pitcherId ? `/pitchers/${r.pitcherId}` : '#'}
                        className="inline-flex items-center gap-1.5 text-zinc-100 hover:text-oracle-green"
                      >
                        {r.pitcherName ?? '—'}
                        <SideBadge side={r.pitcherHand} suffix="HP" />
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <TeamBadge abbrev={r.team} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300">
                      {r.fip?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-100">
                      {r.fdPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {r.dkPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-oracle-green font-semibold">
                      {r.mlFdPts?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-oracle-green/70">
                      {r.mlDkPts?.toFixed(1) ?? '—'}
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
                    <td className="px-3 py-2 text-right text-zinc-300">
                      {proj.ip?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300">
                      {proj.k?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {r.gamePk != null ? (
                        <Link
                          href={`/games/${r.gamePk}`}
                          className="inline-flex items-center gap-1.5 hover:text-oracle-green"
                        >
                          <TeamBadge abbrev={r.opp} size="sm" />
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
