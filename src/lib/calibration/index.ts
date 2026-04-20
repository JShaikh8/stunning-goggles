/**
 * Isotonic calibration lookup tables fit on reconciled hitter-game data.
 * Maps the model's raw Poisson-derived P(X) → observed empirical rate.
 *
 * The raw prediction is computed as `1 - exp(-λ)` where λ = proj.hr or
 * proj.h. Isotonic regression corrects systematic miscalibration (e.g. the
 * 30-day Aug-2025 sample showed low-bucket hitters under-predicted ~5×).
 *
 * Each JSON file has {xs: [0..1], ys: [0..1]} of length 1024. We linearly
 * interpolate between grid points.
 */
import hrTable from './hr.json';
import hitTable from './hit.json';

type Table = { xs: number[]; ys: number[]; name: string };

function interp(table: Table, x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 1) return table.ys[table.ys.length - 1];
  // xs is uniform [0,1] with 1024 points
  const n = table.xs.length;
  const pos = x * (n - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  const y0 = table.ys[i];
  const y1 = table.ys[Math.min(i + 1, n - 1)];
  return y0 + (y1 - y0) * frac;
}

export function calibrateHrProb(rawP: number | null | undefined): number | null {
  if (rawP == null) return null;
  return interp(hrTable as Table, rawP);
}

export function calibrateHitProb(rawP: number | null | undefined): number | null {
  if (rawP == null) return null;
  return interp(hitTable as Table, rawP);
}

export const CALIBRATION_META = {
  hr: { brier_pre: (hrTable as unknown as { brier_pre: number }).brier_pre,
        brier_post: (hrTable as unknown as { brier_post: number }).brier_post },
  hit: { brier_pre: (hitTable as unknown as { brier_pre: number }).brier_pre,
         brier_post: (hitTable as unknown as { brier_post: number }).brier_post },
};
