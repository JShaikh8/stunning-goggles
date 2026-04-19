import {
  pgTable,
  integer,
  bigint,
  varchar,
  text,
  date,
  timestamp,
  real,
  doublePrecision,
  jsonb,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Reference tables ────────────────────────────────────────────────

export const venues = pgTable('venues', {
  venueId: integer('venue_id').primaryKey(),
  name: varchar('name', { length: 200 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  roofType: varchar('roof_type', { length: 50 }),
  lat: real('lat'),
  lng: real('lng'),
});

export const teams = pgTable('teams', {
  teamId: integer('team_id').primaryKey(),
  name: varchar('name', { length: 200 }),
  abbrev: varchar('abbrev', { length: 10 }),
  venueId: integer('venue_id'),
  league: varchar('league', { length: 50 }),
});

export const players = pgTable('players', {
  playerId: integer('player_id').primaryKey(),
  fullName: varchar('full_name', { length: 200 }),
  batSide: varchar('bat_side', { length: 1 }),
  pitchHand: varchar('pitch_hand', { length: 1 }),
  primaryPosition: varchar('primary_position', { length: 10 }),
  teamId: integer('team_id'),
  active: boolean('active'),
});

// ── Games ────────────────────────────────────────────────────────────

export type WeatherShape = {
  condition?: string;
  tempF?: number | null;
  windSpeedMph?: number | null;
  windDir?: string;
};

export const games = pgTable(
  'games',
  {
    gamePk: bigint('game_pk', { mode: 'number' }).primaryKey(),
    gameDate: date('game_date'),
    season: integer('season'),
    homeTeamId: integer('home_team_id'),
    awayTeamId: integer('away_team_id'),
    venueId: integer('venue_id'),
    status: varchar('status', { length: 20 }),
    doubleHeader: varchar('double_header', { length: 1 }),
    gameTimeUtc: timestamp('game_time_utc'),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    weather: jsonb('weather').$type<WeatherShape>(),
  },
  (t) => ({
    dateIdx: index('ix_games_game_date').on(t.gameDate),
  }),
);

export const gamesLog = pgTable('games_log', {
  gamePk: bigint('game_pk', { mode: 'number' }).primaryKey(),
  status: varchar('status', { length: 20 }),
  pitchCount: integer('pitch_count'),
  abCount: integer('ab_count'),
  ingestedAt: timestamp('ingested_at'),
  error: text('error'),
});

// ── Event tables ────────────────────────────────────────────────────

export const atBats = pgTable(
  'at_bats',
  {
    id: bigint('id', { mode: 'number' }).primaryKey(),
    gamePk: bigint('game_pk', { mode: 'number' }),
    atBatIndex: integer('at_bat_index'),
    inning: integer('inning'),
    halfInning: varchar('half_inning', { length: 10 }),
    hitterId: integer('hitter_id'),
    pitcherId: integer('pitcher_id'),
    hitterSide: varchar('hitter_side', { length: 1 }),
    pitcherHand: varchar('pitcher_hand', { length: 1 }),
    event: varchar('event', { length: 80 }),
    eventType: varchar('event_type', { length: 80 }),
    description: text('description'),
    rbi: integer('rbi'),
    exitVelocity: real('exit_velocity'),
    launchAngle: real('launch_angle'),
    launchSpeedAngle: integer('launch_speed_angle'),
    totalDistance: real('total_distance'),
    hitCoordX: real('hit_coord_x'),
    hitCoordY: real('hit_coord_y'),
    trajectory: varchar('trajectory', { length: 50 }),
    hardness: varchar('hardness', { length: 50 }),
    location: varchar('location', { length: 20 }),
    gameDate: date('game_date'),
    season: integer('season'),
  },
);

export const pitches = pgTable('pitches', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  gamePk: bigint('game_pk', { mode: 'number' }),
  atBatIndex: integer('at_bat_index'),
  pitchIndex: integer('pitch_index'),
  hitterId: integer('hitter_id'),
  pitcherId: integer('pitcher_id'),
  pitchType: varchar('pitch_type', { length: 10 }),
  pitchFamily: varchar('pitch_family', { length: 20 }),
  startSpeed: real('start_speed'),
  endSpeed: real('end_speed'),
  spinRate: real('spin_rate'),
  spinDirection: real('spin_direction'),
  px: real('px'),
  pz: real('pz'),
  pitchResult: varchar('pitch_result', { length: 50 }),
  zone: integer('zone'),
  strikes: integer('strikes'),
  balls: integer('balls'),
  gameDate: date('game_date'),
  season: integer('season'),
});

// ── Feature tables ──────────────────────────────────────────────────

export const hitterPitchSplits = pgTable(
  'hitter_pitch_splits',
  {
    hitterId: integer('hitter_id'),
    pitchFamily: varchar('pitch_family', { length: 20 }),
    season: integer('season'),
    pa: integer('pa'),
    ab: integer('ab'),
    hits: integer('hits'),
    hr: integer('hr'),
    bb: integer('bb'),
    k: integer('k'),
    avg: real('avg'),
    slg: real('slg'),
    obp: real('obp'),
    ops: real('ops'),
    swingPct: real('swing_pct'),
    whiffPct: real('whiff_pct'),
    avgExitVelo: real('avg_exit_velo'),
    avgLaunchAngle: real('avg_launch_angle'),
    hardHitPct: real('hard_hit_pct'),
    highVeloWhiffPct: real('high_velo_whiff_pct'),
    highSpinWhiffPct: real('high_spin_whiff_pct'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.hitterId, t.pitchFamily, t.season] }) }),
);

export type PitcherArsenal = Record<
  string,
  {
    count?: number;
    usagePct?: number;
    avgSpeed?: number | null;
    avgSpin?: number | null;
    whiffPct?: number | null;
  }
>;

export const pitcherProfiles = pgTable(
  'pitcher_profiles',
  {
    pitcherId: integer('pitcher_id'),
    season: integer('season'),
    arsenal: jsonb('arsenal').$type<PitcherArsenal>(),
    totalPitches: integer('total_pitches'),
    kPct: real('k_pct'),
    primaryPitch: varchar('primary_pitch', { length: 20 }),
    updatedAt: timestamp('updated_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pitcherId, t.season] }) }),
);

export const pitcherSeasonStats = pgTable(
  'pitcher_season_stats',
  {
    pitcherId: integer('pitcher_id'),
    season: integer('season'),
    avgIp: real('avg_ip'),
    avgK: real('avg_k'),
    avgBb: real('avg_bb'),
    avgH: real('avg_h'),
    avgHr: real('avg_hr'),
    fip: real('fip'),
    gamesStarted: integer('games_started'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pitcherId, t.season] }) }),
);

export type HitLocations = Record<string, number>;

export const parkFactors = pgTable('park_factors', {
  venueId: integer('venue_id').primaryKey(),
  hrFactor: real('hr_factor'),
  hitFactor: real('hit_factor'),
  hardHitFactor: real('hard_hit_factor'),
  kFactor: real('k_factor'),
  bbFactor: real('bb_factor'),
  sampleSize: integer('sample_size'),
  hitLocations: jsonb('hit_locations').$type<HitLocations>(),
  updatedAt: timestamp('updated_at'),
});

export const hitterRecentForm = pgTable('hitter_recent_form', {
  hitterId: integer('hitter_id').primaryKey(),
  formSignal: varchar('form_signal', { length: 10 }),
  formRatio: real('form_ratio'),
  last7: jsonb('last_7'),
  last15: jsonb('last_15'),
  last30: jsonb('last_30'),
  updatedAt: timestamp('updated_at'),
});

export const hitterSprayProfiles = pgTable('hitter_spray_profiles', {
  hitterId: integer('hitter_id').primaryKey(),
  pullPct: real('pull_pct'),
  centerPct: real('center_pct'),
  oppoPct: real('oppo_pct'),
  deepPct: real('deep_pct'),
  shallowPct: real('shallow_pct'),
  infieldPct: real('infield_pct'),
  avgExitVelo: real('avg_exit_velo'),
  avgLaunchAngle: real('avg_launch_angle'),
  hrPullPct: real('hr_pull_pct'),
  updatedAt: timestamp('updated_at'),
});

export const hitterVectors = pgTable('hitter_vectors', {
  hitterId: integer('hitter_id').primaryKey(),
  vector: jsonb('vector'),
  scaledVector: real('scaled_vector').array(),
  updatedAt: timestamp('updated_at'),
});

export type SimilarListEntry = {
  hitter_id?: number;
  hitter_name?: string;
  pitcher_id?: number;
  pitcher_name?: string;
  similarity: number;
};

export const hitterSimilar = pgTable('hitter_similar', {
  hitterId: integer('hitter_id').primaryKey(),
  similarList: jsonb('similar_list').$type<SimilarListEntry[]>(),
  updatedAt: timestamp('updated_at'),
});

export const pitcherVectors = pgTable('pitcher_vectors', {
  pitcherId: integer('pitcher_id').primaryKey(),
  vector: jsonb('vector'),
  scaledVector: real('scaled_vector').array(),
  updatedAt: timestamp('updated_at'),
});

export const pitcherSimilar = pgTable('pitcher_similar', {
  pitcherId: integer('pitcher_id').primaryKey(),
  similarList: jsonb('similar_list').$type<SimilarListEntry[]>(),
  updatedAt: timestamp('updated_at'),
});

// ── Projections ─────────────────────────────────────────────────────

export type FactorMap = {
  park?: number;
  weather?: number;
  platoon?: number;
  stuffQuality?: number;
  recentForm?: number;
  battingOrder?: number;
  matchup?: number;
};

export type HitterProjBlob = {
  h?: number;
  hr?: number;
  bb?: number;
  k?: number;
  r?: number;
  rbi?: number;
  avg?: number;
  slg?: number;
};

export type PitcherProjBlob = {
  ip?: number;
  k?: number;
  bb?: number;
  h?: number;
  hr?: number;
  er?: number;
};

export type ContactQuality = {
  avgLaunchAngle?: number | null;
  avgExitVelo?: number | null;
};

export const projections = pgTable(
  'projections',
  {
    hitterId: integer('hitter_id'),
    gamePk: bigint('game_pk', { mode: 'number' }),
    gameDate: date('game_date'),
    pitcherId: integer('pitcher_id'),
    proj: jsonb('proj').$type<HitterProjBlob>(),
    dkPts: doublePrecision('dk_pts'),
    fdPts: doublePrecision('fd_pts'),
    baselineDkPts: doublePrecision('baseline_dk_pts'),
    dkDelta: doublePrecision('dk_delta'),
    factors: jsonb('factors').$type<FactorMap>(),
    factorScore: doublePrecision('factor_score'),
    contactQuality: jsonb('contact_quality').$type<ContactQuality>(),
    expectedPa: doublePrecision('expected_pa'),
    lineupSlot: integer('lineup_slot'),
    weather: jsonb('weather').$type<WeatherShape>(),
    hitterHand: varchar('hitter_hand', { length: 1 }),
    pitcherHand: varchar('pitcher_hand', { length: 1 }),
    lineupSource: varchar('lineup_source', { length: 30 }),
    side: varchar('side', { length: 4 }),
    tunedDkPts: doublePrecision('tuned_dk_pts'),
    mlDkPts: doublePrecision('ml_dk_pts'),
    mlFdPts: doublePrecision('ml_fd_pts'),
    mlDelta: doublePrecision('ml_delta'),
    blendDkPts: doublePrecision('blend_dk_pts'),
    blendFdPts: doublePrecision('blend_fd_pts'),
    createdAt: timestamp('created_at'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.hitterId, t.gamePk] }),
    dateIdx: index('ix_projections_date').on(t.gameDate),
  }),
);

export const pitcherProjections = pgTable(
  'pitcher_projections',
  {
    pitcherId: integer('pitcher_id'),
    gamePk: bigint('game_pk', { mode: 'number' }),
    gameDate: date('game_date'),
    proj: jsonb('proj').$type<PitcherProjBlob>(),
    dkPts: doublePrecision('dk_pts'),
    fdPts: doublePrecision('fd_pts'),
    fip: real('fip'),
    gamesStarted: integer('games_started'),
    stuffSignal: varchar('stuff_signal', { length: 10 }),
    modelVersion: varchar('model_version', { length: 20 }),
    lineupSource: varchar('lineup_source', { length: 30 }),
    side: varchar('side', { length: 4 }),
    mlDkPts: doublePrecision('ml_dk_pts'),
    mlFdPts: doublePrecision('ml_fd_pts'),
    mlDelta: doublePrecision('ml_delta'),
    createdAt: timestamp('created_at'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pitcherId, t.gamePk] }),
  }),
);

export type NrfiTopThreat = {
  hitter_id: number;
  hitter_name: string;
  team?: string;
  side?: string;
  lineup_slot?: number;
  dk_pts?: number;
  fi_run_contrib: number;
};

export type NrfiPitcherSummary = {
  pitcher_id?: number;
  pitcher_name?: string;
  fip?: number | null;
  stuff_signal?: string | null;
  dk_pts?: number | null;
};

export type NrfiBatterSummary = {
  hitter_id: number;
  hitter_name: string;
  lineup_slot: number;
  dk_pts: number;
  proj: HitterProjBlob;
  fi_weight: number;
  p_on_base?: number;
  probs?: {
    single?: number; double?: number; triple?: number; home_run?: number;
    walk?: number; hit_by_pitch?: number; strikeout?: number; out?: number;
  };
};

export const nrfiProjections = pgTable('nrfi_projections', {
  gamePk: bigint('game_pk', { mode: 'number' }).primaryKey(),
  gameDate: date('game_date'),
  nrfiProb: real('nrfi_prob'),
  nrfiPct: real('nrfi_pct'),
  yrfiPct: real('yrfi_pct'),
  homeXr: real('home_xr'),
  awayXr: real('away_xr'),
  homePScoreless: real('home_p_scoreless'),
  awayPScoreless: real('away_p_scoreless'),
  homePScore: real('home_p_score'),
  awayPScore: real('away_p_score'),
  topThreats: jsonb('top_threats').$type<NrfiTopThreat[]>(),
  homeTopBatters: jsonb('home_top_batters').$type<NrfiBatterSummary[]>(),
  awayTopBatters: jsonb('away_top_batters').$type<NrfiBatterSummary[]>(),
  homePitcher: jsonb('home_pitcher').$type<NrfiPitcherSummary>(),
  awayPitcher: jsonb('away_pitcher').$type<NrfiPitcherSummary>(),
  createdAt: timestamp('created_at'),
});

// ── Reconciliation ──────────────────────────────────────────────────

export const projectionActuals = pgTable(
  'projection_actuals',
  {
    hitterId: integer('hitter_id'),
    gamePk: bigint('game_pk', { mode: 'number' }),
    gameDate: date('game_date'),
    projDkPts: doublePrecision('proj_dk_pts'),
    actualDkPts: doublePrecision('actual_dk_pts'),
    proj: jsonb('proj').$type<HitterProjBlob>(),
    actual: jsonb('actual'),
    dkError: doublePrecision('dk_error'),
    absDkError: doublePrecision('abs_dk_error'),
    reconciledAt: timestamp('reconciled_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.hitterId, t.gamePk] }) }),
);

export const pitcherProjectionActuals = pgTable(
  'pitcher_projection_actuals',
  {
    pitcherId: integer('pitcher_id'),
    gamePk: bigint('game_pk', { mode: 'number' }),
    gameDate: date('game_date'),
    projDkPts: doublePrecision('proj_dk_pts'),
    actualDkPts: doublePrecision('actual_dk_pts'),
    proj: jsonb('proj').$type<PitcherProjBlob>(),
    actual: jsonb('actual'),
    dkError: doublePrecision('dk_error'),
    absDkError: doublePrecision('abs_dk_error'),
    reconciledAt: timestamp('reconciled_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pitcherId, t.gamePk] }) }),
);

// ── FanDuel DFS slate prices ────────────────────────────────────────

export const fdSlatePrices = pgTable(
  'fd_slate_prices',
  {
    slateDate: date('slate_date'),
    fdPlayerId: varchar('fd_player_id', { length: 50 }),
    fdName: varchar('fd_name', { length: 200 }),
    position: varchar('position', { length: 20 }),
    salary: integer('salary'),
    fppg: real('fppg'),
    team: varchar('team', { length: 10 }),
    opponent: varchar('opponent', { length: 10 }),
    game: varchar('game', { length: 20 }),
    injuryIndicator: varchar('injury_indicator', { length: 10 }),
    battingOrder: integer('batting_order'),
    probablePitcher: boolean('probable_pitcher'),
    matchedPlayerId: integer('matched_player_id'),
    uploadedAt: timestamp('uploaded_at'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.slateDate, t.fdPlayerId] }) }),
);


export const nrfiActuals = pgTable('nrfi_actuals', {
  gamePk: bigint('game_pk', { mode: 'number' }).primaryKey(),
  gameDate: date('game_date'),
  predictedNrfiProb: real('predicted_nrfi_prob'),
  actualNrfi: boolean('actual_nrfi'),
  homeFiRuns: integer('home_fi_runs'),
  awayFiRuns: integer('away_fi_runs'),
  reconciledAt: timestamp('reconciled_at'),
});
