/**
 * Static data source — reads JSON snapshots from public/data/.
 * Activated when process.env.DATA_MODE === 'static' (set in render.yaml).
 *
 * The Python script `scripts/export_for_ui.py` writes these files; the UI
 * doesn't talk to Postgres in this mode. Designed for Render hosting where
 * the pipeline + database stay on the user's local machine.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

async function readJson<T = unknown>(rel: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, rel), 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') return null;
    throw err;
  }
}

type Meta = { dates: string[]; today: string; exported_at: string };

// ── Meta ────────────────────────────────────────────────────────────

export async function static_getMeta(): Promise<Meta> {
  const meta = await readJson<Meta>('meta.json');
  return meta ?? { dates: [], today: new Date().toISOString().slice(0, 10), exported_at: '' };
}

export async function static_getTodayGameDates(): Promise<string[]> {
  const meta = await static_getMeta();
  return meta.dates;
}

export async function static_getAvailableSlateDates(): Promise<string[]> {
  const meta = await static_getMeta();
  return meta.dates;
}

export async function static_getCalibrationDateRange(): Promise<[string, string] | null> {
  const cal = await readJson<{ rows: { game_date: string }[] }>('calibration.json');
  if (!cal?.rows?.length) return null;
  const dates = cal.rows.map((r) => r.game_date).sort();
  return [dates[0], dates[dates.length - 1]];
}

// ── Slate / NRFI / Props / Players ──────────────────────────────────

export async function static_getSlate(date: string) {
  const rows = (await readJson<Record<string, unknown>[]>(`slate/${date}.json`)) ?? [];
  return rows.map((r) => ({
    gamePk: r.game_pk,
    gameDate: r.game_date,
    status: r.status,
    gameTimeUtc: r.game_time_utc,
    weather: r.weather,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    venueId: r.venue_id,
    homeAbbrev: r.home_abbrev,
    homeName: r.home_name,
    awayAbbrev: r.away_abbrev,
    awayName: r.away_name,
    venueName: r.venue_name,
    nrfiPct: r.nrfi_pct,
    yrfiPct: r.yrfi_pct,
    nrfiProb: r.nrfi_prob,
    homePitcher: r.home_pitcher,
    awayPitcher: r.away_pitcher,
    nrfiTrend: r.nrfiTrend ?? [],
    homeLineupSource: r.home_lineup_source ?? null,
    awayLineupSource: r.away_lineup_source ?? null,
  }));
}

export async function static_getNrfiSlate(date: string) {
  const rows = (await readJson<Record<string, unknown>[]>(`nrfi/${date}.json`)) ?? [];
  return rows.map((r) => ({
    gamePk: r.game_pk,
    gameDate: r.game_date,
    nrfiProb: r.nrfi_prob,
    nrfiPct: r.nrfi_pct,
    yrfiPct: r.yrfi_pct,
    homeXr: r.home_xr,
    awayXr: r.away_xr,
    homePScoreless: r.home_p_scoreless,
    awayPScoreless: r.away_p_scoreless,
    homePScore: r.home_p_score,
    awayPScore: r.away_p_score,
    topThreats: r.top_threats,
    homeTopBatters: r.home_top_batters,
    awayTopBatters: r.away_top_batters,
    homePitcher: r.home_pitcher,
    awayPitcher: r.away_pitcher,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    venueId: r.venue_id,
    venueName: r.venue_name,
    gameTimeUtc: r.game_time_utc,
    weather: r.weather,
    homeAbbrev: r.home_abbrev,
    awayAbbrev: r.away_abbrev,
  }));
}

export type StaticPropsRowRaw = {
  hitter_id: number;
  game_pk: number;
  hitter_name: string | null;
  hitter_hand: string | null;
  pitcher_id: number | null;
  pitcher_name: string | null;
  pitcher_hand: string | null;
  lineup_slot: number | null;
  expected_pa: number | null;
  proj: { h?: number; hr?: number; bb?: number } | null;
  side: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  weather: unknown;
  venue_id: number | null;
  venue_name: string | null;
  park_hr_factor: number | null;
  pull_pct: number | null;
  avg_exit_velo: number | null;
  avg_launch_angle: number | null;
  form_ratio: number | null;
  pitcher_hr9: number | null;
  pitcher_fip: number | null;
  barrel_pct: number | null;
  hard_hit_pct: number | null;
  last15_hr: number | null;
  own_abbrev: string | null;
  opp_abbrev: string | null;
};

export async function static_getPropsSlateRaw(date: string): Promise<StaticPropsRowRaw[]> {
  return (await readJson<StaticPropsRowRaw[]>(`props/${date}.json`)) ?? [];
}

export async function static_getBattersSlate(date: string) {
  const rows = (await readJson<Record<string, unknown>[]>(`batters/${date}.json`)) ?? [];
  return rows.map((r) => ({
    hitterId: r.hitter_id,
    gamePk: r.game_pk,
    hitterName: r.hitter_name,
    hitterHand: r.hitter_hand,
    pitcherId: r.pitcher_id,
    pitcherName: r.pitcher_name,
    side: r.side,
    lineupSlot: r.lineup_slot,
    dkPts: r.dk_pts,
    fdPts: r.fd_pts,
    tunedDkPts: r.tuned_dk_pts,
    mlDkPts: r.ml_dk_pts,
    mlFdPts: r.ml_fd_pts,
    mlDelta: r.ml_delta,
    blendDkPts: r.blend_dk_pts,
    blendFdPts: r.blend_fd_pts,
    factors: r.factors,
    factorScore: r.factor_score,
    proj: r.proj,
    expectedPa: r.expected_pa,
    homeAbbrev: r.home_abbrev,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    team: r.team,
    opp: r.opp,
    seasonDkAvg: r.season_dk_avg,
    seasonFdAvg: r.season_fd_avg,
    seasonGames: r.season_games,
  }));
}

export async function static_getPitchersSlate(date: string) {
  const rows = (await readJson<Record<string, unknown>[]>(`pitchers/${date}.json`)) ?? [];
  return rows.map((r) => ({
    pitcherId: r.pitcher_id,
    gamePk: r.game_pk,
    pitcherName: r.pitcher_name,
    pitcherHand: r.pitcher_hand,
    side: r.side,
    dkPts: r.dk_pts,
    fdPts: r.fd_pts,
    mlDkPts: r.ml_dk_pts,
    mlFdPts: r.ml_fd_pts,
    mlDelta: r.ml_delta,
    fip: r.fip,
    gamesStarted: r.games_started,
    proj: r.proj,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    team: r.team,
    opp: r.opp,
  }));
}

// ── Game / Hitter / Pitcher detail ─────────────────────────────────

export async function static_getGameDetail(gamePk: number) {
  return await readJson<unknown>(`games/${gamePk}.json`);
}

export async function static_getHitterDetail(hitterId: number) {
  return await readJson<unknown>(`hitters/${hitterId}.json`);
}

export async function static_getPitcherDetail(pitcherId: number) {
  return await readJson<unknown>(`pitchers-detail/${pitcherId}.json`);
}

// ── DFS / Calibration ──────────────────────────────────────────────

export async function static_getDfsPool(date: string) {
  return (await readJson<Record<string, unknown>[]>(`dfs/${date}.json`)) ?? [];
}

export async function static_getCalibrationRaw(): Promise<{
  rows: {
    game_date: string;
    actual_dk_pts: number | null;
    factor_dk: number | null;
    tuned_dk_pts: number | null;
    ml_dk_pts: number | null;
    blend_dk_pts: number | null;
  }[];
}> {
  return (await readJson('calibration.json')) ?? { rows: [] };
}

// ── Flag ────────────────────────────────────────────────────────────

export const IS_STATIC_MODE = process.env.DATA_MODE === 'static';
