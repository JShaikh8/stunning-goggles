'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Row = {
  projDkPts: number | null;
  actualDkPts: number | null;
};

export function CalibrationScatter({ rows }: { rows: Row[] }) {
  const pts = rows
    .filter((r) => r.projDkPts != null && r.actualDkPts != null)
    .map((r) => ({ x: r.projDkPts as number, y: r.actualDkPts as number }));

  const max = Math.max(40, ...pts.map((p) => Math.max(p.x, p.y)));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 30 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="2 2" />
        <XAxis
          type="number"
          dataKey="x"
          name="proj DK"
          domain={[0, max]}
          stroke="#52525b"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          label={{ value: 'Projected DK', position: 'insideBottom', offset: -10, fill: '#71717a' }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="actual DK"
          domain={[0, max]}
          stroke="#52525b"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          label={{ value: 'Actual DK', angle: -90, position: 'insideLeft', fill: '#71717a' }}
        />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: max, y: max },
          ]}
          stroke="#f59e0b"
          strokeDasharray="4 4"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#09090b',
            border: '1px solid #27272a',
            fontSize: '11px',
          }}
        />
        <Scatter data={pts} fill="#10b981" fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function MAELine({ rows }: { rows: { date: string; mae: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={rows} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="2 2" />
        <XAxis
          dataKey="date"
          stroke="#52525b"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
        />
        <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#09090b',
            border: '1px solid #27272a',
            fontSize: '11px',
          }}
        />
        <Line
          type="monotone"
          dataKey="mae"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
