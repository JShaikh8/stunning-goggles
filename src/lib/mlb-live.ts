/**
 * Thin client for MLB StatsAPI — used at request time to pull live-line and
 * final-boxscore data for game pages.
 */

type Linescore = {
  currentInning?: number;
  currentInningOrdinal?: string;
  inningState?: string;
  isTopInning?: boolean;
  innings?: Array<{
    num: number;
    home?: { runs?: number; hits?: number; errors?: number };
    away?: { runs?: number; hits?: number; errors?: number };
  }>;
  teams?: {
    home?: { runs?: number; hits?: number; errors?: number };
    away?: { runs?: number; hits?: number; errors?: number };
  };
};

type BoxscorePlayer = {
  person: { id: number; fullName: string };
  position?: { abbreviation?: string };
  battingOrder?: string;
  stats?: {
    batting?: {
      atBats?: number;
      runs?: number;
      hits?: number;
      doubles?: number;
      triples?: number;
      homeRuns?: number;
      rbi?: number;
      baseOnBalls?: number;
      strikeOuts?: number;
      stolenBases?: number;
      avg?: string;
    };
    pitching?: {
      inningsPitched?: string;
      hits?: number;
      runs?: number;
      earnedRuns?: number;
      baseOnBalls?: number;
      strikeOuts?: number;
      homeRuns?: number;
      pitchesThrown?: number;
      era?: string;
    };
  };
};

type Boxscore = {
  teams?: {
    home?: { players?: Record<string, BoxscorePlayer> };
    away?: { players?: Record<string, BoxscorePlayer> };
  };
};

type FeedLive = {
  gameData?: {
    status?: { abstractGameState?: string; detailedState?: string };
    datetime?: { dateTime?: string };
  };
  liveData?: {
    linescore?: Linescore;
    boxscore?: Boxscore;
  };
};

/**
 * Pulls a single game's live feed (linescore + boxscore + status).
 * Cached by Next.js for 30 seconds to survive dev-mode rapid refresh.
 */
export async function fetchLiveGame(gamePk: number): Promise<FeedLive | null> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as FeedLive;
  } catch {
    return null;
  }
}

export type {
  Linescore,
  Boxscore,
  BoxscorePlayer,
  FeedLive,
};
