import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './client';
import { calibrateHrProb, calibrateHitProb } from '@/lib/calibration';
import {
  IS_STATIC_MODE,
  static_getSlate,
  static_getNrfiSlate,
  static_getPropsSlateRaw,
  static_getBattersSlate,
  static_getPitchersSlate,
  static_getGameDetail,
  static_getHitterDetail,
  static_getPitcherDetail,
  static_getDfsPool,
  static_getCalibrationRaw,
  static_getTodayGameDates,
  static_getAvailableSlateDates,
  static_getCalibrationDateRange,
  type StaticPropsRowRaw,
} from './static-source';
import {
  atBats,
  games,
  hitterRecentForm,
  hitterSimilar,
  hitterSprayProfiles,
  hitterPitchSplits,
  nrfiProjections,
  parkFactors,
  pitcherProjections,
  players,
  projectionActuals,
  projections,
  teams,
  venues,
} from './schema';

// ── Slate ───────────────────────────────────────────────────────────

export async function getSlate(gameDate: string) {
  if (IS_STATIC_MODE) return static_getSlate(gameDate) as never;
  const rows = await db
    .select({
      gamePk: games.gamePk,
      gameDate: games.gameDate,
      status: games.status,
      gameTimeUtc: games.gameTimeUtc,
      weather: games.weather,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      venueId: games.venueId,
      homeAbbrev: teams.abbrev,
      homeName: teams.name,
      venueName: venues.name,
      nrfiPct: nrfiProjections.nrfiPct,
      yrfiPct: nrfiProjections.yrfiPct,
      nrfiProb: nrfiProjections.nrfiProb,
      homePitcher: nrfiProjections.homePitcher,
      awayPitcher: nrfiProjections.awayPitcher,
    })
    .from(games)
    .leftJoin(teams, eq(teams.teamId, games.homeTeamId))
    .leftJoin(venues, eq(venues.venueId, games.venueId))
    .leftJoin(nrfiProjections, eq(nrfiProjections.gamePk, games.gamePk))
    .where(eq(games.gameDate, gameDate))
    .orderBy(asc(games.gameTimeUtc));

  // Per-side lineup source: 'confirmed' if any projection on that side was
  // marked confirmed; otherwise 'fallback' (previous game's batting order).
  const srcRows = await db.execute(sql`
    SELECT game_pk, side,
           CASE WHEN BOOL_OR(lineup_source = 'confirmed') THEN 'confirmed' ELSE 'fallback' END AS lineup_source
    FROM projections WHERE game_date = ${gameDate}
    GROUP BY game_pk, side
  `);
  const srcList = asRows<{ game_pk: number; side: string; lineup_source: string }>(srcRows);
  const srcMap = new Map<string, string>();
  for (const s of srcList) srcMap.set(`${s.game_pk}:${s.side}`, s.lineup_source);

  const awayIds = rows.map((r) => r.awayTeamId).filter(Boolean) as number[];
  const awayTeams = awayIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, awayIds))
    : [];
  const awayMap = new Map(awayTeams.map((t) => [t.teamId, t]));

  // Fetch last-7 NRFI trend for each home team (strictly before this date)
  const homeTeamIds = Array.from(new Set(
    rows.map((r) => r.homeTeamId).filter(Boolean) as number[],
  ));
  const trendMap = new Map<number, { d: string; pct: number }[]>();
  if (homeTeamIds.length) {
    const idList = sql.join(homeTeamIds.map((id) => sql`${id}`), sql`, `);
    const trendRows = await db.execute(sql`
      WITH ranked AS (
        SELECT g.home_team_id, g.game_date::text AS d, np.nrfi_pct,
               ROW_NUMBER() OVER (PARTITION BY g.home_team_id ORDER BY g.game_date DESC) AS rn
        FROM nrfi_projections np
        JOIN games g ON g.game_pk = np.game_pk
        WHERE g.home_team_id IN (${idList})
          AND g.game_date < ${gameDate}
          AND np.nrfi_pct IS NOT NULL
      )
      SELECT home_team_id, d, nrfi_pct FROM ranked WHERE rn <= 7
      ORDER BY home_team_id, d ASC
    `);
    const trendList = asRows<{ home_team_id: number; d: string; nrfi_pct: number }>(trendRows);
    for (const r of trendList) {
      if (!trendMap.has(r.home_team_id)) trendMap.set(r.home_team_id, []);
      trendMap.get(r.home_team_id)!.push({ d: r.d, pct: r.nrfi_pct });
    }
  }

  return rows.map((r) => ({
    ...r,
    awayAbbrev: r.awayTeamId ? awayMap.get(r.awayTeamId)?.abbrev ?? null : null,
    awayName: r.awayTeamId ? awayMap.get(r.awayTeamId)?.name ?? null : null,
    nrfiTrend: r.homeTeamId ? trendMap.get(r.homeTeamId) ?? [] : [],
    homeLineupSource: srcMap.get(`${r.gamePk}:home`) ?? null,
    awayLineupSource: srcMap.get(`${r.gamePk}:away`) ?? null,
  }));
}

// ── Game detail ──────────────────────────────────────────────────────

export async function getGameDetail(gamePk: number) {
  if (IS_STATIC_MODE) return static_getGameDetail(gamePk) as never;
  const [game] = await db
    .select({
      gamePk: games.gamePk,
      gameDate: games.gameDate,
      gameTimeUtc: games.gameTimeUtc,
      status: games.status,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
      weather: games.weather,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      venueId: games.venueId,
      venueName: venues.name,
    })
    .from(games)
    .leftJoin(venues, eq(venues.venueId, games.venueId))
    .where(eq(games.gamePk, gamePk));

  if (!game) return null;

  const ids = [game.homeTeamId, game.awayTeamId].filter(Boolean) as number[];
  const teamRows = ids.length
    ? await db.select().from(teams).where(inArray(teams.teamId, ids))
    : [];
  const homeTeam = teamRows.find((t) => t.teamId === game.homeTeamId) ?? null;
  const awayTeam = teamRows.find((t) => t.teamId === game.awayTeamId) ?? null;

  const hitters = await db
    .select({
      hitterId: projections.hitterId,
      hitterName: players.fullName,
      hitterHand: projections.hitterHand,
      pitcherId: projections.pitcherId,
      lineupSlot: projections.lineupSlot,
      side: projections.side,
      dkPts: projections.dkPts,
      fdPts: projections.fdPts,
      baselineDkPts: projections.baselineDkPts,
      dkDelta: projections.dkDelta,
      factors: projections.factors,
      factorScore: projections.factorScore,
      proj: projections.proj,
      expectedPa: projections.expectedPa,
      tunedDkPts: projections.tunedDkPts,
      mlDkPts: projections.mlDkPts,
      mlFdPts: projections.mlFdPts,
      mlDelta: projections.mlDelta,
      blendDkPts: projections.blendDkPts,
      blendFdPts: projections.blendFdPts,
    })
    .from(projections)
    .leftJoin(players, eq(players.playerId, projections.hitterId))
    .where(eq(projections.gamePk, gamePk))
    .orderBy(asc(projections.side), asc(projections.lineupSlot));

  const pitchers = await db
    .select({
      pitcherId: pitcherProjections.pitcherId,
      pitcherName: players.fullName,
      pitcherHand: players.pitchHand,
      side: pitcherProjections.side,
      dkPts: pitcherProjections.dkPts,
      fdPts: pitcherProjections.fdPts,
      mlDkPts: pitcherProjections.mlDkPts,
      mlFdPts: pitcherProjections.mlFdPts,
      mlDelta: pitcherProjections.mlDelta,
      proj: pitcherProjections.proj,
      fip: pitcherProjections.fip,
      gamesStarted: pitcherProjections.gamesStarted,
    })
    .from(pitcherProjections)
    .leftJoin(players, eq(players.playerId, pitcherProjections.pitcherId))
    .where(eq(pitcherProjections.gamePk, gamePk));

  const [nrfi] = await db
    .select()
    .from(nrfiProjections)
    .where(eq(nrfiProjections.gamePk, gamePk));

  return {
    game,
    homeTeam,
    awayTeam,
    hitters,
    pitchers,
    nrfi: nrfi ?? null,
  };
}

// ── Hitter detail ────────────────────────────────────────────────────

export async function getHitterDetail(hitterId: number) {
  if (IS_STATIC_MODE) return static_getHitterDetail(hitterId) as never;
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.playerId, hitterId));
  if (!player) return null;

  const [form] = await db
    .select()
    .from(hitterRecentForm)
    .where(eq(hitterRecentForm.hitterId, hitterId));

  const [spray] = await db
    .select()
    .from(hitterSprayProfiles)
    .where(eq(hitterSprayProfiles.hitterId, hitterId));

  const [similar] = await db
    .select()
    .from(hitterSimilar)
    .where(eq(hitterSimilar.hitterId, hitterId));

  const splits = await db
    .select()
    .from(hitterPitchSplits)
    .where(eq(hitterPitchSplits.hitterId, hitterId))
    .orderBy(desc(hitterPitchSplits.season));

  const recentProjections = await db
    .select({
      gameDate: projections.gameDate,
      dkPts: projections.dkPts,
      fdPts: projections.fdPts,
      proj: projections.proj,
      factorScore: projections.factorScore,
      factors: projections.factors,
    })
    .from(projections)
    .where(eq(projections.hitterId, hitterId))
    .orderBy(desc(projections.gameDate))
    .limit(30);

  // Recent hit coords for spray chart (last ~100 balls in play)
  const sprayHits = await db
    .select({
      hitCoordX: atBats.hitCoordX,
      hitCoordY: atBats.hitCoordY,
      eventType: atBats.eventType,
      exitVelocity: atBats.exitVelocity,
      launchAngle: atBats.launchAngle,
      gameDate: atBats.gameDate,
    })
    .from(atBats)
    .where(
      and(
        eq(atBats.hitterId, hitterId),
        sql`${atBats.hitCoordX} IS NOT NULL`,
        sql`${atBats.hitCoordY} IS NOT NULL`,
      ),
    )
    .orderBy(desc(atBats.gameDate))
    .limit(200);

  return {
    player,
    form: form ?? null,
    spray: spray ?? null,
    similar: similar ?? null,
    splits,
    recentProjections,
    sprayHits,
  };
}

// ── Season / rolling stats per hitter ────────────────────────────────

export type HitterSeasonStats = {
  seasonGames: number;
  seasonDkAvg: number | null;
  seasonFdAvg: number | null;
  seasonAvg: number | null;
  seasonSlg: number | null;
  last15DkAvg: number | null;
  last15Games: number;
};

// Cast helper — postgres-js's db.execute returns a RowList (array-ish).
function asRows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  if (r.rows && Array.isArray(r.rows)) return r.rows;
  if (Array.isArray(result)) return result as T[];
  return [];
}

export async function getHitterSeasonStats(
  hitterId: number,
  season: number,
): Promise<HitterSeasonStats> {
  const r1 = await db.execute(sql`
    WITH per_game AS (
      SELECT game_pk,
        SUM(CASE event_type
          WHEN 'single' THEN 3 WHEN 'double' THEN 5 WHEN 'triple' THEN 8
          WHEN 'home_run' THEN 10 WHEN 'walk' THEN 2 WHEN 'intent_walk' THEN 2
          WHEN 'hit_by_pitch' THEN 2
          WHEN 'strikeout' THEN -0.5 WHEN 'strikeout_double_play' THEN -0.5
          ELSE 0 END) + COALESCE(SUM(rbi), 0) * 2 AS dk,
        SUM(CASE event_type
          WHEN 'single' THEN 3 WHEN 'double' THEN 6 WHEN 'triple' THEN 9
          WHEN 'home_run' THEN 12 WHEN 'walk' THEN 3 WHEN 'intent_walk' THEN 3
          WHEN 'hit_by_pitch' THEN 3
          ELSE 0 END) + COALESCE(SUM(rbi), 0) * 3.5 AS fd,
        SUM(CASE WHEN event_type IN ('single','double','triple','home_run') THEN 1 ELSE 0 END) AS hits,
        SUM(CASE event_type WHEN 'single' THEN 1 WHEN 'double' THEN 2
          WHEN 'triple' THEN 3 WHEN 'home_run' THEN 4 ELSE 0 END) AS total_bases,
        SUM(CASE WHEN event_type NOT IN ('walk','intent_walk','hit_by_pitch','sac_fly','sac_bunt') THEN 1 ELSE 0 END) AS ab
      FROM at_bats
      WHERE hitter_id = ${hitterId} AND season = ${season}
      GROUP BY game_pk
    )
    SELECT COUNT(*)::int AS season_games,
           AVG(dk)::float AS season_dk_avg,
           AVG(fd)::float AS season_fd_avg,
           (SUM(hits)::float / NULLIF(SUM(ab), 0))::float AS season_avg,
           (SUM(total_bases)::float / NULLIF(SUM(ab), 0))::float AS season_slg
    FROM per_game
  `);
  const rows1 = asRows<{
    season_games: number; season_dk_avg: number | null;
    season_fd_avg: number | null; season_avg: number | null; season_slg: number | null;
  }>(r1);
  const s = rows1[0];

  const r2 = await db.execute(sql`
    WITH per_game AS (
      SELECT game_date,
        SUM(CASE event_type
          WHEN 'single' THEN 3 WHEN 'double' THEN 5 WHEN 'triple' THEN 8
          WHEN 'home_run' THEN 10 WHEN 'walk' THEN 2 WHEN 'intent_walk' THEN 2
          WHEN 'hit_by_pitch' THEN 2
          WHEN 'strikeout' THEN -0.5 WHEN 'strikeout_double_play' THEN -0.5
          ELSE 0 END) + COALESCE(SUM(rbi), 0) * 2 AS dk
      FROM at_bats
      WHERE hitter_id = ${hitterId}
      GROUP BY game_pk, game_date
    ),
    ranked AS (
      SELECT dk, ROW_NUMBER() OVER (ORDER BY game_date DESC) AS rn FROM per_game
    )
    SELECT AVG(dk)::float AS last15_dk_avg, COUNT(*)::int AS last15_games
    FROM ranked WHERE rn <= 15
  `);
  const rows2 = asRows<{ last15_dk_avg: number | null; last15_games: number }>(r2);
  const r = rows2[0];

  return {
    seasonGames: s?.season_games ?? 0,
    seasonDkAvg: s?.season_dk_avg ?? null,
    seasonFdAvg: s?.season_fd_avg ?? null,
    seasonAvg: s?.season_avg ?? null,
    seasonSlg: s?.season_slg ?? null,
    last15DkAvg: r?.last15_dk_avg ?? null,
    last15Games: r?.last15_games ?? 0,
  };
}

/** Batch per-hitter season DK/FD averages. */
export async function getSeasonAvgBatch(
  hitterIds: number[],
  season: number,
): Promise<Map<number, { dkAvg: number | null; fdAvg: number | null; games: number }>> {
  if (!hitterIds.length) return new Map();
  const idList = sql.join(hitterIds.map((id) => sql`${id}`), sql`, `);
  const result = await db.execute(sql`
    WITH per_game AS (
      SELECT hitter_id, game_pk,
        SUM(CASE event_type
          WHEN 'single' THEN 3 WHEN 'double' THEN 5 WHEN 'triple' THEN 8
          WHEN 'home_run' THEN 10 WHEN 'walk' THEN 2 WHEN 'intent_walk' THEN 2
          WHEN 'hit_by_pitch' THEN 2
          WHEN 'strikeout' THEN -0.5 WHEN 'strikeout_double_play' THEN -0.5
          ELSE 0 END) + COALESCE(SUM(rbi), 0) * 2 AS dk,
        SUM(CASE event_type
          WHEN 'single' THEN 3 WHEN 'double' THEN 6 WHEN 'triple' THEN 9
          WHEN 'home_run' THEN 12 WHEN 'walk' THEN 3 WHEN 'intent_walk' THEN 3
          WHEN 'hit_by_pitch' THEN 3
          ELSE 0 END) + COALESCE(SUM(rbi), 0) * 3.5 AS fd
      FROM at_bats
      WHERE hitter_id IN (${idList}) AND season = ${season}
      GROUP BY hitter_id, game_pk
    )
    SELECT hitter_id, AVG(dk)::float AS dk_avg, AVG(fd)::float AS fd_avg, COUNT(*)::int AS games
    FROM per_game GROUP BY hitter_id
  `);
  const rows = asRows<{ hitter_id: number; dk_avg: number | null; fd_avg: number | null; games: number }>(result);
  const out = new Map<number, { dkAvg: number | null; fdAvg: number | null; games: number }>();
  for (const r of rows) {
    out.set(r.hitter_id, { dkAvg: r.dk_avg, fdAvg: r.fd_avg, games: r.games });
  }
  return out;
}

// ── Pitcher detail ───────────────────────────────────────────────────

export async function getPitcherDetail(pitcherId: number) {
  if (IS_STATIC_MODE) return static_getPitcherDetail(pitcherId) as never;
  const [player] = await db.select().from(players).where(eq(players.playerId, pitcherId));
  if (!player) return null;

  // Season stats (career IPs etc.) — joined with season-agg
  const seasonAgg = await db.execute(sql`
    WITH per_start AS (
      SELECT game_pk, season, game_date,
        SUM(CASE WHEN event_type IN ('strikeout','strikeout_double_play') THEN 1 ELSE 0 END) AS k,
        SUM(CASE WHEN event_type IN ('walk','intent_walk') THEN 1 ELSE 0 END) AS bb,
        SUM(CASE WHEN event_type = 'home_run' THEN 1 ELSE 0 END) AS hr,
        SUM(CASE WHEN event_type IN ('single','double','triple','home_run') THEN 1 ELSE 0 END) AS h,
        COUNT(*) AS bf
      FROM at_bats
      WHERE pitcher_id = ${pitcherId}
      GROUP BY game_pk, season, game_date
      HAVING COUNT(*) >= 12
    )
    SELECT season,
           COUNT(*)::int AS starts,
           AVG(k)::float  AS avg_k,
           AVG(bb)::float AS avg_bb,
           AVG(hr)::float AS avg_hr,
           AVG(h)::float  AS avg_h,
           AVG(bf)::float AS avg_bf
    FROM per_start
    GROUP BY season
    ORDER BY season DESC
  `);
  const seasons = asRows<{
    season: number; starts: number;
    avg_k: number | null; avg_bb: number | null; avg_hr: number | null;
    avg_h: number | null; avg_bf: number | null;
  }>(seasonAgg);

  // Upcoming / recent pitcher projections
  const recentProj = await db
    .select()
    .from(pitcherProjections)
    .where(eq(pitcherProjections.pitcherId, pitcherId))
    .orderBy(desc(pitcherProjections.gameDate))
    .limit(15);

  // Reconciled actuals (DK pts) for past starts
  const reconciled = await db.execute(sql`
    SELECT game_date, proj_dk_pts, actual_dk_pts, dk_error, abs_dk_error, actual
    FROM pitcher_projection_actuals
    WHERE pitcher_id = ${pitcherId}
    ORDER BY game_date DESC
    LIMIT 15
  `);

  return {
    player,
    seasons,
    recentProj,
    reconciled: asRows<{
      game_date: string;
      proj_dk_pts: number | null;
      actual_dk_pts: number | null;
      dk_error: number | null;
      abs_dk_error: number | null;
      actual: { ip?: number; k?: number; bb?: number; h?: number; hr?: number } | null;
    }>(reconciled),
  };
}


// ── NRFI slate ───────────────────────────────────────────────────────

export async function getNrfiSlate(gameDate: string) {
  if (IS_STATIC_MODE) return static_getNrfiSlate(gameDate) as never;
  const rows = await db
    .select({
      gamePk: nrfiProjections.gamePk,
      gameDate: nrfiProjections.gameDate,
      nrfiProb: nrfiProjections.nrfiProb,
      nrfiPct: nrfiProjections.nrfiPct,
      yrfiPct: nrfiProjections.yrfiPct,
      homeXr: nrfiProjections.homeXr,
      awayXr: nrfiProjections.awayXr,
      homePScoreless: nrfiProjections.homePScoreless,
      awayPScoreless: nrfiProjections.awayPScoreless,
      homePScore: nrfiProjections.homePScore,
      awayPScore: nrfiProjections.awayPScore,
      topThreats: nrfiProjections.topThreats,
      homeTopBatters: nrfiProjections.homeTopBatters,
      awayTopBatters: nrfiProjections.awayTopBatters,
      homePitcher: nrfiProjections.homePitcher,
      awayPitcher: nrfiProjections.awayPitcher,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      venueId: games.venueId,
      venueName: venues.name,
      gameTimeUtc: games.gameTimeUtc,
      weather: games.weather,
    })
    .from(nrfiProjections)
    .leftJoin(games, eq(games.gamePk, nrfiProjections.gamePk))
    .leftJoin(venues, eq(venues.venueId, games.venueId))
    .where(eq(nrfiProjections.gameDate, gameDate))
    .orderBy(desc(nrfiProjections.nrfiPct));

  // Hydrate team abbrevs
  const teamIds = Array.from(new Set(
    rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter(Boolean) as number[],
  ));
  const tteams = teamIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, teamIds))
    : [];
  const tmap = new Map(tteams.map((t) => [t.teamId, t]));

  return rows.map((r) => ({
    ...r,
    homeAbbrev: r.homeTeamId ? tmap.get(r.homeTeamId)?.abbrev ?? null : null,
    awayAbbrev: r.awayTeamId ? tmap.get(r.awayTeamId)?.abbrev ?? null : null,
  }));
}


export async function getHitterRecentReconciliation(hitterId: number) {
  const rows = await db
    .select({
      gameDate: projectionActuals.gameDate,
      gamePk: projectionActuals.gamePk,
      projDkPts: projectionActuals.projDkPts,
      actualDkPts: projectionActuals.actualDkPts,
      dkError: projectionActuals.dkError,
      absDkError: projectionActuals.absDkError,
    })
    .from(projectionActuals)
    .where(eq(projectionActuals.hitterId, hitterId))
    .orderBy(desc(projectionActuals.gameDate))
    .limit(15);
  return rows;
}

// ── Players slate (all batters + all pitchers for a date) ───────────

export async function getBattersSlate(gameDate: string) {
  if (IS_STATIC_MODE) return static_getBattersSlate(gameDate) as never;
  const rows = await db
    .select({
      hitterId: projections.hitterId,
      gamePk: projections.gamePk,
      hitterName: players.fullName,
      hitterHand: projections.hitterHand,
      pitcherId: projections.pitcherId,
      side: projections.side,
      lineupSlot: projections.lineupSlot,
      dkPts: projections.dkPts,
      fdPts: projections.fdPts,
      tunedDkPts: projections.tunedDkPts,
      mlDkPts: projections.mlDkPts,
      mlFdPts: projections.mlFdPts,
      mlDelta: projections.mlDelta,
      blendDkPts: projections.blendDkPts,
      blendFdPts: projections.blendFdPts,
      factors: projections.factors,
      factorScore: projections.factorScore,
      proj: projections.proj,
      expectedPa: projections.expectedPa,
      homeAbbrev: teams.abbrev,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
    })
    .from(projections)
    .leftJoin(players, eq(players.playerId, projections.hitterId))
    .leftJoin(games, eq(games.gamePk, projections.gamePk))
    .leftJoin(teams, eq(teams.teamId, games.homeTeamId))
    .where(eq(projections.gameDate, gameDate))
    .orderBy(desc(projections.dkPts));

  // Pitcher names in one follow-up query
  const pids = Array.from(new Set(rows.map((r) => r.pitcherId).filter(Boolean) as number[]));
  const pitchers = pids.length
    ? await db.select().from(players).where(inArray(players.playerId, pids))
    : [];
  const pmap = new Map(pitchers.map((p) => [p.playerId, p]));

  const teamIds = Array.from(new Set(
    rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter(Boolean) as number[],
  ));
  const tteams = teamIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, teamIds))
    : [];
  const tmap = new Map(tteams.map((t) => [t.teamId, t]));

  const hitterIds = Array.from(new Set(rows.map((r) => r.hitterId).filter(Boolean) as number[]));
  const season = Number((gameDate || '').slice(0, 4)) || new Date().getUTCFullYear();
  const seasonStats = await getSeasonAvgBatch(hitterIds, season);

  return rows.map((r) => {
    const opposing = r.side === 'home' ? r.awayTeamId : r.homeTeamId;
    const owning   = r.side === 'home' ? r.homeTeamId : r.awayTeamId;
    const stats = r.hitterId ? seasonStats.get(r.hitterId) : null;
    return {
      ...r,
      pitcherName: r.pitcherId ? pmap.get(r.pitcherId)?.fullName ?? null : null,
      team: owning ? tmap.get(owning)?.abbrev ?? null : null,
      opp:  opposing ? tmap.get(opposing)?.abbrev ?? null : null,
      seasonDkAvg: stats?.dkAvg ?? null,
      seasonFdAvg: stats?.fdAvg ?? null,
      seasonGames: stats?.games ?? 0,
    };
  });
}

export async function getPitchersSlate(gameDate: string) {
  if (IS_STATIC_MODE) return static_getPitchersSlate(gameDate) as never;
  const rows = await db
    .select({
      pitcherId: pitcherProjections.pitcherId,
      gamePk: pitcherProjections.gamePk,
      pitcherName: players.fullName,
      pitcherHand: players.pitchHand,
      side: pitcherProjections.side,
      dkPts: pitcherProjections.dkPts,
      fdPts: pitcherProjections.fdPts,
      mlDkPts: pitcherProjections.mlDkPts,
      mlFdPts: pitcherProjections.mlFdPts,
      mlDelta: pitcherProjections.mlDelta,
      fip: pitcherProjections.fip,
      gamesStarted: pitcherProjections.gamesStarted,
      proj: pitcherProjections.proj,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
    })
    .from(pitcherProjections)
    .leftJoin(players, eq(players.playerId, pitcherProjections.pitcherId))
    .leftJoin(games, eq(games.gamePk, pitcherProjections.gamePk))
    .where(eq(pitcherProjections.gameDate, gameDate))
    .orderBy(desc(pitcherProjections.dkPts));

  const teamIds = Array.from(new Set(
    rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter(Boolean) as number[],
  ));
  const tteams = teamIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, teamIds))
    : [];
  const tmap = new Map(tteams.map((t) => [t.teamId, t]));

  return rows.map((r) => ({
    ...r,
    team: r.side === 'home' ? tmap.get(r.homeTeamId!)?.abbrev : tmap.get(r.awayTeamId!)?.abbrev,
    opp:  r.side === 'home' ? tmap.get(r.awayTeamId!)?.abbrev : tmap.get(r.homeTeamId!)?.abbrev,
  }));
}


// ── Calibration ──────────────────────────────────────────────────────

export async function getCalibrationDateRange(): Promise<[string, string] | null> {
  if (IS_STATIC_MODE) return static_getCalibrationDateRange();
  const result = await db.execute(sql`
    SELECT MIN(game_date)::text AS min_d, MAX(game_date)::text AS max_d
    FROM projection_actuals
  `);
  const rows = asRows<{ min_d: string | null; max_d: string | null }>(result);
  const r = rows[0];
  return r?.min_d && r?.max_d ? [r.min_d, r.max_d] : null;
}

export async function getCalibration(startDate: string, endDate?: string) {
  if (IS_STATIC_MODE) return _calibrationFromStatic(startDate, endDate);
  const end = endDate ?? '9999-12-31';
  // Pull the reconciliation rows WITH each projection flavor so we can
  // compute MAE for factor vs tuned vs ml vs blend.
  const result = await db.execute(sql`
    SELECT pa.game_date, pa.actual_dk_pts,
           pa.proj_dk_pts AS factor_dk,
           p.tuned_dk_pts, p.ml_dk_pts, p.blend_dk_pts
    FROM projection_actuals pa
    JOIN projections p ON p.hitter_id = pa.hitter_id AND p.game_pk = pa.game_pk
    WHERE pa.game_date >= ${startDate} AND pa.game_date <= ${end}
    ORDER BY pa.game_date
  `);

  type Row = {
    game_date: string;
    actual_dk_pts: number | null;
    factor_dk: number | null;
    tuned_dk_pts: number | null;
    ml_dk_pts: number | null;
    blend_dk_pts: number | null;
  };
  const rows = asRows<Row>(result);

  const abs = (v: number | null) => (v == null ? 0 : Math.abs(v));
  const mae = (selector: (r: Row) => number | null) => {
    const vals = rows.map((r) => {
      const p = selector(r);
      const a = r.actual_dk_pts;
      if (p == null || a == null) return null;
      return abs(p - a);
    }).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const bias = (selector: (r: Row) => number | null) => {
    const vals = rows.map((r) => {
      const p = selector(r);
      const a = r.actual_dk_pts;
      if (p == null || a == null) return null;
      return p - a;
    }).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const count = rows.length;
  const factorMae = mae((r) => r.factor_dk);
  const tunedMae  = mae((r) => r.tuned_dk_pts);
  const mlMae     = mae((r) => r.ml_dk_pts);
  const blendMae  = mae((r) => r.blend_dk_pts);
  const factorBias = bias((r) => r.factor_dk);
  const tunedBias  = bias((r) => r.tuned_dk_pts);
  const mlBias     = bias((r) => r.ml_dk_pts);
  const blendBias  = bias((r) => r.blend_dk_pts);

  // Naive baseline — always predict mean of actuals
  const meanActual = count
    ? rows.reduce((s, r) => s + (r.actual_dk_pts ?? 0), 0) / count
    : 0;
  const baselineMae = count
    ? rows.reduce((s, r) => s + Math.abs((r.actual_dk_pts ?? 0) - meanActual), 0) / count
    : 0;

  // RMSE on blend
  const sqSum = rows.reduce((s, r) => {
    const p = r.blend_dk_pts;
    const a = r.actual_dk_pts;
    return p != null && a != null ? s + (p - a) ** 2 : s;
  }, 0);
  const rmse = count ? Math.sqrt(sqSum / count) : 0;

  // Scatter points (use blend) + daily MAE (blend)
  const scatter = rows.map((r) => ({
    projDkPts: r.blend_dk_pts,
    actualDkPts: r.actual_dk_pts,
    dkError: (r.blend_dk_pts ?? 0) - (r.actual_dk_pts ?? 0),
    absDkError: Math.abs((r.blend_dk_pts ?? 0) - (r.actual_dk_pts ?? 0)),
    gameDate: r.game_date,
  }));
  const byDate = new Map<string, { n: number; absSum: number }>();
  for (const s of scatter) {
    const cur = byDate.get(s.gameDate) ?? { n: 0, absSum: 0 };
    cur.n += 1;
    cur.absSum += s.absDkError;
    byDate.set(s.gameDate, cur);
  }
  const byDateArray = Array.from(byDate.entries()).map(([date, v]) => ({
    date,
    mae: v.n ? v.absSum / v.n : 0,
  }));

  return {
    rows: scatter,
    count,
    mae: blendMae,
    rmse,
    byDate: byDateArray,
    compare: {
      factor:   { mae: factorMae, bias: factorBias },
      tuned:    { mae: tunedMae,  bias: tunedBias  },
      ml:       { mae: mlMae,     bias: mlBias     },
      blend:    { mae: blendMae,  bias: blendBias  },
      baseline: { mae: baselineMae, bias: 0 },
      meanActual,
    },
  };
}

// ── FanDuel DFS lineup pool ─────────────────────────────────────────

export type DfsPoolRow = {
  fd_player_id: string;
  fd_name: string;
  position: string;
  salary: number;
  fppg: number | null;
  team: string;
  opponent: string;
  game: string;
  batting_order: number | null;
  injury_indicator: string | null;
  matched_player_id: number | null;
  blend_fd_pts: number | null;
  ml_fd_pts: number | null;
  factor_fd_pts: number | null;
  season_fd_avg: number | null;
};

export async function getDfsPool(slateDate: string): Promise<DfsPoolRow[]> {
  if (IS_STATIC_MODE) return static_getDfsPool(slateDate) as unknown as Promise<DfsPoolRow[]>;
  const result = await db.execute(sql`
    WITH latest_hitter AS (
      SELECT DISTINCT ON (hitter_id)
             hitter_id, blend_fd_pts, ml_fd_pts, fd_pts AS factor_fd_pts
      FROM projections
      WHERE game_date = ${slateDate}
      ORDER BY hitter_id, game_pk
    ),
    latest_pitcher AS (
      SELECT DISTINCT ON (pitcher_id)
             pitcher_id, ml_fd_pts, fd_pts AS factor_fd_pts
      FROM pitcher_projections
      WHERE game_date = ${slateDate}
      ORDER BY pitcher_id, game_pk
    ),
    season_avg AS (
      SELECT hitter_id, AVG(dk)::float AS season_fd_avg
      FROM (
        SELECT hitter_id, game_pk,
          SUM(CASE event_type
            WHEN 'single' THEN 3 WHEN 'double' THEN 6 WHEN 'triple' THEN 9
            WHEN 'home_run' THEN 12 WHEN 'walk' THEN 3 WHEN 'intent_walk' THEN 3
            WHEN 'hit_by_pitch' THEN 3 ELSE 0 END) + COALESCE(SUM(rbi), 0) * 3.5 AS dk
        FROM at_bats
        WHERE season = ${Number(slateDate.slice(0, 4))}
        GROUP BY hitter_id, game_pk
      ) per_game
      GROUP BY hitter_id
    )
    SELECT
      f.fd_player_id, f.fd_name, f.position, f.salary, f.fppg,
      f.team, f.opponent, f.game, f.batting_order, f.injury_indicator,
      f.matched_player_id,
      COALESCE(h.blend_fd_pts, p.ml_fd_pts) AS blend_fd_pts,
      COALESCE(h.ml_fd_pts,    p.ml_fd_pts) AS ml_fd_pts,
      COALESCE(h.factor_fd_pts, p.factor_fd_pts) AS factor_fd_pts,
      s.season_fd_avg
    FROM fd_slate_prices f
    LEFT JOIN latest_hitter  h ON h.hitter_id  = f.matched_player_id
    LEFT JOIN latest_pitcher p ON p.pitcher_id = f.matched_player_id
    LEFT JOIN season_avg     s ON s.hitter_id  = f.matched_player_id
    WHERE f.slate_date = ${slateDate}
  `);
  return asRows<DfsPoolRow>(result);
}

export async function getAvailableSlateDates(): Promise<string[]> {
  if (IS_STATIC_MODE) return static_getAvailableSlateDates();
  const result = await db.execute(sql`
    SELECT DISTINCT slate_date::text AS slate_date
    FROM fd_slate_prices
    ORDER BY slate_date DESC
    LIMIT 20
  `);
  return asRows<{ slate_date: string }>(result).map((r) => r.slate_date);
}


// ── Helpers ──────────────────────────────────────────────────────────

// ── Props (HR + Hits) ────────────────────────────────────────────────

export type PropsRow = {
  hitterId: number;
  gamePk: number;
  hitterName: string | null;
  hitterHand: string | null;
  teamAbbrev: string | null;
  oppAbbrev: string | null;
  venueName: string | null;
  parkHrFactor: number | null;
  pullPct: number | null;
  avgExitVelo: number | null;
  avgLaunchAngle: number | null;
  formRatio: number | null;
  pitcherId: number | null;
  pitcherName: string | null;
  pitcherHand: string | null;
  pitcherHr9: number | null;
  pitcherFip: number | null;
  weather: unknown;
  lineupSlot: number | null;
  projH: number | null;
  projHr: number | null;
  projBb: number | null;
  expectedPa: number | null;
  pHit: number | null;
  pTwoPlusHit: number | null;
  pHr: number | null;
  // Extended batted-ball stats computed from at_bats
  barrelPct: number | null;      // share of batted balls with EV ≥ 98 AND LA 26–30°
  hardHitPct: number | null;     // EV ≥ 95
  last15Hr: number | null;       // HR count in hitter's last 15 games
  vsLHrPct: number | null;       // HR / PA vs LHP (season)
  vsRHrPct: number | null;       // HR / PA vs RHP (season)
  windOut: boolean;              // ≥10mph with outward-facing direction
};

export async function getPropsSlate(gameDate: string): Promise<PropsRow[]> {
  if (IS_STATIC_MODE) return _propsFromStatic(gameDate);
  const result = await db.execute(sql`
    WITH pitcher_hr9 AS (
      SELECT pitcher_id,
        (SUM(CASE WHEN event_type = 'home_run' THEN 1 ELSE 0 END)::float
          / NULLIF(SUM(CASE WHEN event_type IN ('strikeout','strikeout_double_play','walk','intent_walk','field_out','force_out','grounded_into_double_play','fielders_choice_out','single','double','triple','home_run','hit_by_pitch','sac_fly','sac_bunt','field_error') THEN 1 ELSE 0 END), 0)) * 38.0 AS hr9
      FROM at_bats
      WHERE season = ${Number(gameDate.slice(0, 4))}
      GROUP BY pitcher_id
      HAVING SUM(CASE WHEN event_type IN ('strikeout','strikeout_double_play','walk','intent_walk','field_out','force_out','grounded_into_double_play','fielders_choice_out','single','double','triple','home_run','hit_by_pitch','sac_fly','sac_bunt','field_error') THEN 1 ELSE 0 END) >= 50
    )
    SELECT
      p.hitter_id,
      p.game_pk,
      pl.full_name   AS hitter_name,
      p.hitter_hand,
      p.pitcher_id,
      pp.full_name   AS pitcher_name,
      pp.pitch_hand  AS pitcher_hand,
      p.lineup_slot,
      p.expected_pa,
      p.proj,
      p.side,
      g.home_team_id,
      g.away_team_id,
      g.weather,
      g.venue_id,
      v.name         AS venue_name,
      pf.hr_factor   AS park_hr_factor,
      hsp.pull_pct,
      hsp.avg_exit_velo,
      hsp.avg_launch_angle,
      hrf.form_ratio,
      phr.hr9        AS pitcher_hr9,
      pprj.fip       AS pitcher_fip
    FROM projections p
    LEFT JOIN players pl        ON pl.player_id = p.hitter_id
    LEFT JOIN players pp        ON pp.player_id = p.pitcher_id
    LEFT JOIN games g           ON g.game_pk    = p.game_pk
    LEFT JOIN venues v          ON v.venue_id   = g.venue_id
    LEFT JOIN park_factors pf   ON pf.venue_id  = g.venue_id
    LEFT JOIN hitter_spray_profiles hsp ON hsp.hitter_id = p.hitter_id
    LEFT JOIN hitter_recent_form hrf    ON hrf.hitter_id = p.hitter_id
    LEFT JOIN pitcher_hr9 phr   ON phr.pitcher_id = p.pitcher_id
    LEFT JOIN pitcher_projections pprj ON pprj.pitcher_id = p.pitcher_id AND pprj.game_pk = p.game_pk
    WHERE p.game_date = ${gameDate}
  `);

  type Row = {
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
  };
  const rows = asRows<Row>(result);

  const teamIds = Array.from(new Set(
    rows.flatMap((r) => [r.home_team_id, r.away_team_id]).filter(Boolean) as number[],
  ));
  const tteams = teamIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, teamIds))
    : [];
  const tmap = new Map(tteams.map((t) => [t.teamId, t]));

  // Batch-compute batted-ball stats for every hitter on the slate in one pass.
  const hitterIds = Array.from(new Set(rows.map((r) => r.hitter_id)));
  const season = Number(gameDate.slice(0, 4));
  type BbStats = {
    barrelPct: number | null;
    hardHitPct: number | null;
    last15Hr: number | null;
    vsLHrPct: number | null;
    vsRHrPct: number | null;
  };
  const bbMap = new Map<number, BbStats>();

  if (hitterIds.length) {
    const idList = sql.join(hitterIds.map((id) => sql`${id}`), sql`, `);
    const bbRows = await db.execute(sql`
      WITH batted AS (
        SELECT hitter_id, exit_velocity, launch_angle, event_type, pitcher_hand
        FROM at_bats
        WHERE hitter_id IN (${idList})
          AND season = ${season}
          AND exit_velocity IS NOT NULL
          AND launch_angle IS NOT NULL
      ),
      batted_agg AS (
        SELECT hitter_id,
               COUNT(*)::float AS bip,
               SUM(CASE WHEN exit_velocity >= 98 AND launch_angle BETWEEN 26 AND 30 THEN 1 ELSE 0 END)::float AS barrels,
               SUM(CASE WHEN exit_velocity >= 95 THEN 1 ELSE 0 END)::float AS hard
        FROM batted
        GROUP BY hitter_id
      ),
      pa_all AS (
        SELECT hitter_id, pitcher_hand, event_type
        FROM at_bats
        WHERE hitter_id IN (${idList})
          AND season = ${season}
          AND pitcher_hand IN ('L','R')
      ),
      vs_split AS (
        SELECT hitter_id,
               SUM(CASE WHEN pitcher_hand='L' AND event_type='home_run' THEN 1 ELSE 0 END)::float AS vsl_hr,
               SUM(CASE WHEN pitcher_hand='L' THEN 1 ELSE 0 END)::float AS vsl_pa,
               SUM(CASE WHEN pitcher_hand='R' AND event_type='home_run' THEN 1 ELSE 0 END)::float AS vsr_hr,
               SUM(CASE WHEN pitcher_hand='R' THEN 1 ELSE 0 END)::float AS vsr_pa
        FROM pa_all
        GROUP BY hitter_id
      ),
      recent_games AS (
        SELECT hitter_id, game_pk, game_date,
               SUM(CASE WHEN event_type='home_run' THEN 1 ELSE 0 END) AS hr,
               ROW_NUMBER() OVER (PARTITION BY hitter_id ORDER BY game_date DESC) AS rn
        FROM at_bats
        WHERE hitter_id IN (${idList})
        GROUP BY hitter_id, game_pk, game_date
      ),
      last15 AS (
        SELECT hitter_id, SUM(hr)::int AS last15_hr
        FROM recent_games WHERE rn <= 15
        GROUP BY hitter_id
      )
      SELECT h.hitter_id,
             CASE WHEN ba.bip >= 30 THEN (ba.barrels / ba.bip) END AS barrel_pct,
             CASE WHEN ba.bip >= 30 THEN (ba.hard    / ba.bip) END AS hard_pct,
             l15.last15_hr,
             CASE WHEN v.vsl_pa >= 30 THEN (v.vsl_hr / v.vsl_pa) END AS vsl_hr_pct,
             CASE WHEN v.vsr_pa >= 30 THEN (v.vsr_hr / v.vsr_pa) END AS vsr_hr_pct
      FROM (SELECT DISTINCT hitter_id FROM batted UNION SELECT DISTINCT hitter_id FROM pa_all UNION SELECT DISTINCT hitter_id FROM recent_games) h
      LEFT JOIN batted_agg ba ON ba.hitter_id = h.hitter_id
      LEFT JOIN vs_split v    ON v.hitter_id  = h.hitter_id
      LEFT JOIN last15 l15    ON l15.hitter_id = h.hitter_id
    `);
    const bb = asRows<{
      hitter_id: number;
      barrel_pct: number | null;
      hard_pct: number | null;
      last15_hr: number | null;
      vsl_hr_pct: number | null;
      vsr_hr_pct: number | null;
    }>(bbRows);
    for (const r of bb) {
      bbMap.set(r.hitter_id, {
        barrelPct: r.barrel_pct,
        hardHitPct: r.hard_pct,
        last15Hr: r.last15_hr,
        vsLHrPct: r.vsl_hr_pct,
        vsRHrPct: r.vsr_hr_pct,
      });
    }
  }

  return rows.map((r) => {
    const owning   = r.side === 'home' ? r.home_team_id : r.away_team_id;
    const opposing = r.side === 'home' ? r.away_team_id : r.home_team_id;
    const projH = r.proj?.h ?? null;
    const projHr = r.proj?.hr ?? null;
    // Raw Poisson P(≥1) then apply isotonic calibration learned from
    // reconciled hitter-games (see src/lib/calibration/*.json).
    const rawPHit = projH != null ? 1 - Math.exp(-projH) : null;
    const rawPHr  = projHr != null ? 1 - Math.exp(-projHr) : null;
    const pHit = calibrateHitProb(rawPHit);
    const pHr  = calibrateHrProb(rawPHr);
    const pTwoPlusHit = projH != null ? 1 - Math.exp(-projH) - projH * Math.exp(-projH) : null;
    const bb = bbMap.get(r.hitter_id);
    const w = r.weather as { windSpeedMph?: number; windDir?: string } | null;
    const dir = (w?.windDir ?? '').toLowerCase();
    const windOut = (w?.windSpeedMph ?? 0) >= 10 && (dir.includes('out') || /^(cf|lf|rf)/.test(dir));
    return {
      hitterId: r.hitter_id,
      gamePk: r.game_pk,
      hitterName: r.hitter_name,
      hitterHand: r.hitter_hand,
      teamAbbrev: owning ? tmap.get(owning)?.abbrev ?? null : null,
      oppAbbrev: opposing ? tmap.get(opposing)?.abbrev ?? null : null,
      venueName: r.venue_name,
      parkHrFactor: r.park_hr_factor,
      pullPct: r.pull_pct,
      avgExitVelo: r.avg_exit_velo,
      avgLaunchAngle: r.avg_launch_angle,
      formRatio: r.form_ratio,
      pitcherId: r.pitcher_id,
      pitcherName: r.pitcher_name,
      pitcherHand: r.pitcher_hand,
      pitcherHr9: r.pitcher_hr9,
      pitcherFip: r.pitcher_fip,
      weather: r.weather,
      lineupSlot: r.lineup_slot,
      projH,
      projHr,
      projBb: r.proj?.bb ?? null,
      expectedPa: r.expected_pa,
      pHit,
      pTwoPlusHit,
      pHr,
      barrelPct: bb?.barrelPct ?? null,
      hardHitPct: bb?.hardHitPct ?? null,
      last15Hr: bb?.last15Hr ?? null,
      vsLHrPct: bb?.vsLHrPct ?? null,
      vsRHrPct: bb?.vsRHrPct ?? null,
      windOut,
    };
  });
}

/**
 * Last-N batted balls with hit coords for a single hitter, for use in a park
 * spray overlay. Excludes rows without coords.
 */
export async function getHitterSprayHits(hitterId: number, limit = 40) {
  if (IS_STATIC_MODE) {
    type Raw = { hit_coord_x: number | null; hit_coord_y: number | null; event_type: string | null };
    const h = (await static_getHitterDetail(hitterId)) as { sprayHits?: Raw[] } | null;
    return (h?.sprayHits ?? []).slice(0, limit).map((r) => ({
      hitCoordX: r.hit_coord_x,
      hitCoordY: r.hit_coord_y,
      eventType: r.event_type,
    }));
  }
  const rows = await db
    .select({
      hitCoordX: atBats.hitCoordX,
      hitCoordY: atBats.hitCoordY,
      eventType: atBats.eventType,
    })
    .from(atBats)
    .where(
      and(
        eq(atBats.hitterId, hitterId),
        sql`${atBats.hitCoordX} IS NOT NULL`,
        sql`${atBats.hitCoordY} IS NOT NULL`,
      ),
    )
    .orderBy(desc(atBats.gameDate))
    .limit(limit);
  return rows;
}

export async function getTodayGameDates(): Promise<string[]> {
  if (IS_STATIC_MODE) return static_getTodayGameDates();
  const result = await db
    .select({ date: sql<string>`DISTINCT ${games.gameDate}` })
    .from(projections)
    .innerJoin(games, eq(games.gamePk, projections.gamePk))
    .orderBy(desc(games.gameDate))
    .limit(30);
  return result.map((r) => r.date);
}

// ══════════════════ Static-mode helpers ══════════════════
// Mirror the SQL logic of getPropsSlate() + getCalibration() but operate on
// snapshot JSON instead of hitting Postgres.

async function _propsFromStatic(gameDate: string): Promise<PropsRow[]> {
  const rows = await static_getPropsSlateRaw(gameDate);
  return rows.map((r: StaticPropsRowRaw) => {
    const projH = r.proj?.h ?? null;
    const projHr = r.proj?.hr ?? null;
    const rawPHit = projH != null ? 1 - Math.exp(-projH) : null;
    const rawPHr  = projHr != null ? 1 - Math.exp(-projHr) : null;
    const pHit = calibrateHitProb(rawPHit);
    const pHr  = calibrateHrProb(rawPHr);
    const pTwoPlusHit = projH != null ? 1 - Math.exp(-projH) - projH * Math.exp(-projH) : null;
    const weather = r.weather as { windSpeedMph?: number; windDir?: string } | null;
    const dir = (weather?.windDir ?? '').toLowerCase();
    const windOut = (weather?.windSpeedMph ?? 0) >= 10 && (dir.includes('out') || /^(cf|lf|rf)/.test(dir));
    return {
      hitterId: r.hitter_id,
      gamePk: r.game_pk,
      hitterName: r.hitter_name,
      hitterHand: r.hitter_hand,
      teamAbbrev: r.own_abbrev,
      oppAbbrev: r.opp_abbrev,
      venueName: r.venue_name,
      parkHrFactor: r.park_hr_factor,
      pullPct: r.pull_pct,
      avgExitVelo: r.avg_exit_velo,
      avgLaunchAngle: r.avg_launch_angle,
      formRatio: r.form_ratio,
      pitcherId: r.pitcher_id,
      pitcherName: r.pitcher_name,
      pitcherHand: r.pitcher_hand,
      pitcherHr9: r.pitcher_hr9,
      pitcherFip: r.pitcher_fip,
      weather: r.weather,
      lineupSlot: r.lineup_slot,
      projH,
      projHr,
      projBb: r.proj?.bb ?? null,
      expectedPa: r.expected_pa,
      pHit,
      pTwoPlusHit,
      pHr,
      barrelPct: r.barrel_pct,
      hardHitPct: r.hard_hit_pct,
      last15Hr: r.last15_hr,
      vsLHrPct: null,
      vsRHrPct: null,
      windOut,
    } as PropsRow;
  });
}

async function _calibrationFromStatic(startDate: string, endDate?: string) {
  const { rows } = await static_getCalibrationRaw();
  const end = endDate ?? '9999-12-31';
  const filtered = rows.filter((r) => r.game_date >= startDate && r.game_date <= end);

  const abs = (v: number | null) => (v == null ? 0 : Math.abs(v));
  const mae = (sel: (r: typeof rows[number]) => number | null) => {
    const vals = filtered.map((r) => {
      const p = sel(r), a = r.actual_dk_pts;
      return p == null || a == null ? null : abs(p - a);
    }).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const bias = (sel: (r: typeof rows[number]) => number | null) => {
    const vals = filtered.map((r) => {
      const p = sel(r), a = r.actual_dk_pts;
      return p == null || a == null ? null : p - a;
    }).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const count = filtered.length;
  const factorMae = mae((r) => r.factor_dk);
  const tunedMae  = mae((r) => r.tuned_dk_pts);
  const mlMae     = mae((r) => r.ml_dk_pts);
  const blendMae  = mae((r) => r.blend_dk_pts);
  const factorBias = bias((r) => r.factor_dk);
  const tunedBias  = bias((r) => r.tuned_dk_pts);
  const mlBias     = bias((r) => r.ml_dk_pts);
  const blendBias  = bias((r) => r.blend_dk_pts);
  const meanActual = count ? filtered.reduce((s, r) => s + (r.actual_dk_pts ?? 0), 0) / count : 0;
  const baselineMae = count
    ? filtered.reduce((s, r) => s + Math.abs((r.actual_dk_pts ?? 0) - meanActual), 0) / count
    : 0;

  const sqSum = filtered.reduce((s, r) => {
    const p = r.blend_dk_pts, a = r.actual_dk_pts;
    return p != null && a != null ? s + (p - a) ** 2 : s;
  }, 0);
  const rmse = count ? Math.sqrt(sqSum / count) : 0;

  const scatter = filtered.map((r) => ({
    projDkPts: r.blend_dk_pts,
    actualDkPts: r.actual_dk_pts,
    dkError: (r.blend_dk_pts ?? 0) - (r.actual_dk_pts ?? 0),
    absDkError: Math.abs((r.blend_dk_pts ?? 0) - (r.actual_dk_pts ?? 0)),
    gameDate: r.game_date,
  }));
  const byDate = new Map<string, { n: number; absSum: number }>();
  for (const s of scatter) {
    const cur = byDate.get(s.gameDate) ?? { n: 0, absSum: 0 };
    cur.n += 1;
    cur.absSum += s.absDkError;
    byDate.set(s.gameDate, cur);
  }
  const byDateArray = Array.from(byDate.entries()).map(([date, v]) => ({
    date,
    mae: v.n ? v.absSum / v.n : 0,
  }));

  return {
    rows: scatter,
    count,
    mae: blendMae,
    rmse,
    byDate: byDateArray,
    compare: {
      factor:   { mae: factorMae, bias: factorBias },
      tuned:    { mae: tunedMae,  bias: tunedBias  },
      ml:       { mae: mlMae,     bias: mlBias     },
      blend:    { mae: blendMae,  bias: blendBias  },
      baseline: { mae: baselineMae, bias: 0 },
      meanActual,
    },
  };
}
