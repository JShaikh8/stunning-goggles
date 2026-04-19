import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './client';
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

  const awayIds = rows.map((r) => r.awayTeamId).filter(Boolean) as number[];
  const awayTeams = awayIds.length
    ? await db.select().from(teams).where(inArray(teams.teamId, awayIds))
    : [];
  const awayMap = new Map(awayTeams.map((t) => [t.teamId, t]));

  return rows.map((r) => ({
    ...r,
    awayAbbrev: r.awayTeamId ? awayMap.get(r.awayTeamId)?.abbrev ?? null : null,
    awayName: r.awayTeamId ? awayMap.get(r.awayTeamId)?.name ?? null : null,
  }));
}

// ── Game detail ──────────────────────────────────────────────────────

export async function getGameDetail(gamePk: number) {
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
  const result = await db.execute(sql`
    SELECT MIN(game_date)::text AS min_d, MAX(game_date)::text AS max_d
    FROM projection_actuals
  `);
  const rows = asRows<{ min_d: string | null; max_d: string | null }>(result);
  const r = rows[0];
  return r?.min_d && r?.max_d ? [r.min_d, r.max_d] : null;
}

export async function getCalibration(startDate: string, endDate?: string) {
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
  const result = await db.execute(sql`
    SELECT DISTINCT slate_date::text AS slate_date
    FROM fd_slate_prices
    ORDER BY slate_date DESC
    LIMIT 20
  `);
  return asRows<{ slate_date: string }>(result).map((r) => r.slate_date);
}


// ── Helpers ──────────────────────────────────────────────────────────

export async function getTodayGameDates(): Promise<string[]> {
  const result = await db
    .select({ date: sql<string>`DISTINCT ${games.gameDate}` })
    .from(projections)
    .innerJoin(games, eq(games.gamePk, projections.gamePk))
    .orderBy(desc(games.gameDate))
    .limit(30);
  return result.map((r) => r.date);
}
