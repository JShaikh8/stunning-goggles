'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import type { FactorMap } from '@/lib/db/schema';

const LABEL: Record<keyof FactorMap, string> = {
  park: 'Park',
  weather: 'Wx',
  platoon: 'Platoon',
  stuffQuality: 'Stuff',
  recentForm: 'Form',
  battingOrder: 'Order',
  matchup: 'Match',
};

export function FactorRadar({ factors }: { factors: FactorMap }) {
  const data = Object.entries(LABEL).map(([k, label]) => ({
    factor: label,
    value: (factors[k as keyof FactorMap] ?? 0) + 1, // shift 0..2 for display
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis dataKey="factor" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 2]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.35}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
