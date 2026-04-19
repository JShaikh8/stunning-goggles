'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type SprayPoint = {
  hitCoordX: number | null;
  hitCoordY: number | null;
  eventType: string | null;
  exitVelocity?: number | null;
  launchAngle?: number | null;
  gameDate?: string | Date | null;
};

type Category = 'hr' | 'xbh' | 'single' | 'out';

const HOME_X = 125;
const HOME_Y = 204;
const PX_PER_FT = 0.43; // ~175 px / 400 ft

const COLOR: Record<Category, string> = {
  hr: '#f59e0b',
  xbh: '#10b981',
  single: '#60a5fa',
  out: '#52525b',
};

const LABEL: Record<Category, string> = {
  hr: 'HR',
  xbh: 'XBH',
  single: '1B',
  out: 'Out',
};

const ALL_CATS: readonly Category[] = ['hr', 'xbh', 'single', 'out'];

function classify(evt: string | null | undefined): Category {
  if (evt === 'home_run') return 'hr';
  if (evt === 'double' || evt === 'triple') return 'xbh';
  if (evt === 'single') return 'single';
  return 'out';
}

function prettyEvent(evt: string | null | undefined): string {
  if (!evt) return '—';
  return evt
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  return s.slice(5); // MM-DD
}

function distanceFt(x: number, y: number): number {
  const dx = x - HOME_X;
  const dy = HOME_Y - y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) / PX_PER_FT);
}

export function SprayChart({ hits }: { hits: SprayPoint[] }) {
  const valid = useMemo(
    () => hits.filter((h) => h.hitCoordX != null && h.hitCoordY != null),
    [hits],
  );

  const [active, setActive] = useState<Set<Category>>(new Set(ALL_CATS));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { hr: 0, xbh: 0, single: 0, out: 0 };
    for (const h of valid) c[classify(h.eventType)] += 1;
    return c;
  }, [valid]);

  const visibleIndices = useMemo(
    () =>
      valid
        .map((h, i) => (active.has(classify(h.eventType)) ? i : -1))
        .filter((i) => i >= 0),
    [valid, active],
  );

  function toggleCat(c: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      // If toggling the only-active, restore all instead of emptying
      if (next.has(c) && next.size === 1) {
        return new Set(ALL_CATS);
      }
      // Soloing: if exactly all active, clicking one isolates just that category.
      if (next.size === ALL_CATS.length) {
        return new Set([c]);
      }
      if (next.has(c)) next.delete(c);
      else next.add(c);
      if (next.size === 0) return new Set(ALL_CATS);
      return next;
    });
    setSelectedIdx(null);
  }

  const VB_W = 250;
  const VB_H = 230;
  const arc = (ft: number) => ft * PX_PER_FT;
  const arcs = [150, 250, 350, 420];
  const cos45 = Math.cos(Math.PI / 4);
  const foulLen = arc(420);
  const foulLX = HOME_X - foulLen * cos45;
  const foulRX = HOME_X + foulLen * cos45;
  const foulY = HOME_Y - foulLen * cos45;

  const selected = selectedIdx != null ? valid[selectedIdx] : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Field + legend */}
      <div className="flex flex-col">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto"
          style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
        >
          <defs>
            <radialGradient id="grass" cx="50%" cy="100%" r="100%">
              <stop offset="0%" stopColor="#14532d" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#064e3b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#052e16" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Fair-territory wedge */}
          <path
            d={`M ${HOME_X} ${HOME_Y}
                L ${foulLX} ${foulY}
                A ${arc(420)} ${arc(420)} 0 0 1 ${foulRX} ${foulY}
                Z`}
            fill="url(#grass)"
            stroke="#14532d"
            strokeWidth="0.6"
          />

          {/* Distance arcs */}
          {arcs.map((ft) => {
            const r = arc(ft);
            const x1 = HOME_X - r * cos45;
            const x2 = HOME_X + r * cos45;
            const y = HOME_Y - r * cos45;
            return (
              <g key={ft}>
                <path
                  d={`M ${x1} ${y} A ${r} ${r} 0 0 1 ${x2} ${y}`}
                  stroke="#27272a"
                  strokeWidth="0.5"
                  fill="none"
                  strokeDasharray="2 2"
                />
                <text x={HOME_X + 1} y={HOME_Y - r - 1} fontSize="5" fill="#52525b">
                  {ft}
                </text>
              </g>
            );
          })}

          {/* Foul lines */}
          <line x1={HOME_X} y1={HOME_Y} x2={foulLX} y2={foulY} stroke="#52525b" strokeWidth="0.6" />
          <line x1={HOME_X} y1={HOME_Y} x2={foulRX} y2={foulY} stroke="#52525b" strokeWidth="0.6" />

          {/* Infield diamond */}
          <g transform={`translate(${HOME_X} ${HOME_Y})`}>
            <polygon
              points={`0,0 ${arc(90) * cos45},${-arc(90) * cos45} 0,${-arc(90) * 1.41} ${-arc(90) * cos45},${-arc(90) * cos45}`}
              fill="#713f12"
              fillOpacity="0.25"
              stroke="#78350f"
              strokeWidth="0.5"
            />
            {[
              [0, 0],
              [arc(90) * cos45, -arc(90) * cos45],
              [0, -arc(90) * 1.41],
              [-arc(90) * cos45, -arc(90) * cos45],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x - 1.5}
                y={y - 1.5}
                width={3}
                height={3}
                fill="#f5f5f4"
                stroke="#78350f"
                strokeWidth="0.3"
                transform={`rotate(45 ${x} ${y})`}
              />
            ))}
          </g>

          {/* Hit points */}
          {valid.map((h, i) => {
            const cat = classify(h.eventType);
            const on = active.has(cat);
            const isSel = selectedIdx === i;
            return (
              <circle
                key={i}
                cx={h.hitCoordX!}
                cy={h.hitCoordY!}
                r={isSel ? 3.4 : cat === 'hr' ? 2.2 : 1.6}
                fill={COLOR[cat]}
                fillOpacity={!on ? 0.08 : cat === 'out' ? 0.45 : 0.85}
                stroke={isSel ? '#fafafa' : cat === 'hr' ? '#fcd34d' : 'none'}
                strokeWidth={isSel ? 0.9 : 0.4}
                onClick={() => setSelectedIdx(isSel ? null : i)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </svg>

        {/* Legend — clickable */}
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_CATS.map((k) => {
            const on = active.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleCat(k)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition',
                  on
                    ? 'border-zinc-700 bg-zinc-900/60 text-zinc-200'
                    : 'border-zinc-800 bg-zinc-900/20 text-zinc-600 hover:text-zinc-400',
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLOR[k] }}
                />
                {LABEL[k]} · {counts[k]}
              </button>
            );
          })}
          <button
            onClick={() => {
              setActive(new Set(ALL_CATS));
              setSelectedIdx(null);
            }}
            className="ml-auto font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            reset
          </button>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-zinc-400">{prettyEvent(selected.eventType)}</span>
              <span className="text-zinc-500">{fmtDate(selected.gameDate ?? null)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-zinc-300">
              <div>
                <span className="block text-[9px] uppercase text-zinc-500">Distance</span>
                {distanceFt(selected.hitCoordX!, selected.hitCoordY!)} ft
              </div>
              <div>
                <span className="block text-[9px] uppercase text-zinc-500">Exit velo</span>
                {selected.exitVelocity != null ? `${selected.exitVelocity.toFixed(1)} mph` : '—'}
              </div>
              <div>
                <span className="block text-[9px] uppercase text-zinc-500">Launch °</span>
                {selected.launchAngle != null ? `${selected.launchAngle.toFixed(0)}°` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AB results table */}
      <div className="max-h-[420px] overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/30">
        <table className="w-full font-mono text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 text-zinc-500 backdrop-blur">
            <tr>
              <th className="px-2 py-1.5 text-left">Result</th>
              <th className="px-2 py-1.5 text-right">Dist</th>
              <th className="px-2 py-1.5 text-right">EV</th>
              <th className="px-2 py-1.5 text-right">LA</th>
              <th className="px-2 py-1.5 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {visibleIndices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-zinc-600">
                  No hits match the current filter.
                </td>
              </tr>
            ) : (
              visibleIndices.map((i) => {
                const h = valid[i];
                const cat = classify(h.eventType);
                const isSel = selectedIdx === i;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedIdx(isSel ? null : i)}
                    className={cn(
                      'cursor-pointer border-t border-zinc-800/60 transition',
                      isSel
                        ? 'bg-zinc-800/80 text-zinc-100'
                        : 'hover:bg-zinc-800/40',
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: COLOR[cat] }}
                      />
                      {prettyEvent(h.eventType)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-300">
                      {distanceFt(h.hitCoordX!, h.hitCoordY!)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-300">
                      {h.exitVelocity != null ? h.exitVelocity.toFixed(0) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-300">
                      {h.launchAngle != null ? `${h.launchAngle.toFixed(0)}°` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-500">
                      {fmtDate(h.gameDate ?? null)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
