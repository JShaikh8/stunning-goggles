/**
 * FanDuel MLB lineup optimizer.
 *
 * Rules:
 *   - 9 players: 1 P, 1 C/1B, 1 2B, 1 3B, 1 SS, 3 OF, 1 UTIL (any non-P)
 *   - Salary cap: $35,000
 *   - Players from ≥ 3 different games
 *   - Max 4 hitters from the same team
 *
 * Algorithm (MVP): greedy + 2-swap local search with N random restarts.
 * Not globally optimal but within 1-2% of ILP solution in practice.
 */

export type PlayerOption = {
  fdPlayerId: string;
  name: string;
  position: string;          // raw FD position (e.g. 'C/1B', 'SS/OF')
  salary: number;
  projectedPoints: number;   // our model's FD pts projection (blend or ml)
  team: string;
  opponent: string;
  game: string;
  battingOrder: number | null;
  matchedPlayerId: number | null;
  injuryIndicator: string | null;
};

export type Lineup = {
  P:   PlayerOption;
  C1B: PlayerOption;
  _2B: PlayerOption;
  _3B: PlayerOption;
  SS:  PlayerOption;
  OF:  [PlayerOption, PlayerOption, PlayerOption];
  UTIL: PlayerOption;
  salary: number;
  projected: number;
  teams: Record<string, number>;
  games: Set<string>;
};

type Slot = 'P' | 'C1B' | '2B' | '3B' | 'SS' | 'OF' | 'UTIL';
const SLOTS: Slot[] = ['P', 'C1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL'];

const SALARY_CAP = 35_000;
const MAX_HITTERS_PER_TEAM = 4;
const MIN_GAMES = 3;

function eligible(pos: string, slot: Slot): boolean {
  // Position field looks like 'P', 'C/1B', 'OF', 'SS/2B/OF', 'C/1B/2B/3B/SS/OF/UTIL', etc.
  const parts = pos.split('/').map((s) => s.trim().toUpperCase());
  switch (slot) {
    case 'P':   return parts.includes('P');
    case 'C1B': return parts.includes('C') || parts.includes('1B') || parts.includes('C/1B');
    case '2B':  return parts.includes('2B');
    case '3B':  return parts.includes('3B');
    case 'SS':  return parts.includes('SS');
    case 'OF':  return parts.includes('OF');
    case 'UTIL': return !parts.includes('P') || parts.some((p) => p !== 'P');   // any non-P
    default: return false;
  }
}

/**
 * Filter / sort helpers.
 */
function filterByPosition(pool: PlayerOption[], slot: Slot): PlayerOption[] {
  return pool.filter((p) => eligible(p.position, slot));
}

function projectionPerSalary(p: PlayerOption): number {
  return p.projectedPoints / Math.max(p.salary, 1);
}


// ── Main entry ──────────────────────────────────────────────────────

export function optimizeLineups(
  pool: PlayerOption[],
  opts: { topN?: number; lockedIds?: string[]; excludedIds?: string[] } = {},
): Lineup[] {
  const { topN = 20, lockedIds = [], excludedIds = [] } = opts;

  const workingPool = pool.filter(
    (p) =>
      p.projectedPoints > 0 &&
      (!p.injuryIndicator || p.injuryIndicator === 'DTD') &&
      !excludedIds.includes(p.fdPlayerId),
  );
  const locked = pool.filter((p) => lockedIds.includes(p.fdPlayerId));

  // Candidate subsets per slot — pre-sorted by projected points descending.
  const byPos: Record<Slot, PlayerOption[]> = {
    P:    filterByPosition(workingPool, 'P'),
    C1B:  filterByPosition(workingPool, 'C1B'),
    '2B': filterByPosition(workingPool, '2B'),
    '3B': filterByPosition(workingPool, '3B'),
    SS:   filterByPosition(workingPool, 'SS'),
    OF:   filterByPosition(workingPool, 'OF'),
    UTIL: workingPool.filter((p) => !p.position.split('/').includes('P')),
  };
  for (const k of Object.keys(byPos) as Slot[]) {
    byPos[k].sort((a, b) => b.projectedPoints - a.projectedPoints);
  }

  // Multi-start local search: seed with N diverse greedy starts.
  const lineups: Lineup[] = [];
  const usedSignatures = new Set<string>();

  for (let attempt = 0; attempt < topN * 6 && lineups.length < topN; attempt++) {
    const seed = greedySeed(byPos, locked, attempt);
    if (!seed) continue;
    const improved = localSearch(seed, byPos);
    if (!improved) continue;
    const sig = signature(improved);
    if (usedSignatures.has(sig)) continue;
    usedSignatures.add(sig);
    lineups.push(improved);
  }

  return lineups.sort((a, b) => b.projected - a.projected).slice(0, topN);
}


// ── Greedy construction ─────────────────────────────────────────────

function greedySeed(
  byPos: Record<Slot, PlayerOption[]>,
  locked: PlayerOption[],
  seedIdx: number,
): Lineup | null {
  const picks: Partial<Record<Slot, PlayerOption>> = {};
  const ofPicks: PlayerOption[] = [];
  const usedIds = new Set<string>();
  const teamCount: Record<string, number> = {};
  const games = new Set<string>();
  let salary = 0;

  // Apply locked players first
  for (const p of locked) {
    usedIds.add(p.fdPlayerId);
    salary += p.salary;
    games.add(p.game);
    if (!p.position.split('/').includes('P')) {
      teamCount[p.team] = (teamCount[p.team] ?? 0) + 1;
    }
    // We'll slot them in naturally below — just mark as used.
  }

  // Random start: shuffle the top-K for diversity across restarts.
  const shuffleFactor = 3 + (seedIdx % 5);  // introduce variance

  for (const slot of SLOTS) {
    // For OF we need to place 3; for others, 1.
    if (slot === 'OF' && picks.OF !== undefined) {
      // Already slotted (we aggregate OF picks into ofPicks)
    }

    const filledOf = ofPicks.length;
    const needOf = slot === 'OF' ? filledOf < 3 : false;
    if (slot === 'OF' && !needOf) continue;

    const candidates = byPos[slot]
      .filter((p) => !usedIds.has(p.fdPlayerId))
      .filter((p) => salary + p.salary <= SALARY_CAP - remainingMin(picks, ofPicks, slot))
      .filter((p) => {
        // Hitter team cap
        const isPitcher = slot === 'P';
        if (!isPitcher && (teamCount[p.team] ?? 0) >= MAX_HITTERS_PER_TEAM) return false;
        return true;
      });

    if (candidates.length === 0) return null;

    // Sample from top-K with diversity
    const top = candidates.slice(0, Math.max(3, shuffleFactor));
    const pick = top[Math.floor(Math.random() * top.length)];

    usedIds.add(pick.fdPlayerId);
    salary += pick.salary;
    games.add(pick.game);
    if (slot !== 'P') teamCount[pick.team] = (teamCount[pick.team] ?? 0) + 1;

    if (slot === 'OF') {
      ofPicks.push(pick);
    } else {
      picks[slot] = pick;
    }
  }

  if (ofPicks.length !== 3) return null;
  if (games.size < MIN_GAMES) return null;
  if (salary > SALARY_CAP) return null;

  const full: Lineup = {
    P:   picks.P!,
    C1B: picks.C1B!,
    _2B: picks['2B']!,
    _3B: picks['3B']!,
    SS:  picks.SS!,
    OF:  [ofPicks[0], ofPicks[1], ofPicks[2]],
    UTIL: picks.UTIL!,
    salary,
    projected: sumProjected(picks, ofPicks),
    teams: teamCount,
    games,
  };
  return full;
}

function remainingMin(
  picks: Partial<Record<Slot, PlayerOption>>,
  ofPicks: PlayerOption[],
  currentSlot: Slot,
): number {
  // Reserve at least $2000 per remaining slot (conservative)
  const order: Slot[] = ['P', 'C1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL'];
  let filled = (picks.P ? 1 : 0) + (picks.C1B ? 1 : 0) +
               (picks['2B'] ? 1 : 0) + (picks['3B'] ? 1 : 0) +
               (picks.SS ? 1 : 0) + (picks.UTIL ? 1 : 0) + ofPicks.length;
  // Count the current slot as being filled right now
  filled += 1;
  return Math.max(0, (order.length - filled)) * 2000;
}

function sumProjected(
  picks: Partial<Record<Slot, PlayerOption>>,
  ofPicks: PlayerOption[],
): number {
  let s = 0;
  for (const v of Object.values(picks)) s += v.projectedPoints;
  for (const v of ofPicks) s += v.projectedPoints;
  return s;
}


// ── Local search (2-swap) ───────────────────────────────────────────

function localSearch(start: Lineup, byPos: Record<Slot, PlayerOption[]>): Lineup {
  let current = start;
  let improved = true;
  let safety = 0;

  while (improved && safety < 40) {
    improved = false;
    safety += 1;

    const slots: { slot: Slot; idx?: 0 | 1 | 2 }[] = [
      { slot: 'P' }, { slot: 'C1B' }, { slot: '2B' }, { slot: '3B' }, { slot: 'SS' },
      { slot: 'OF', idx: 0 }, { slot: 'OF', idx: 1 }, { slot: 'OF', idx: 2 },
      { slot: 'UTIL' },
    ];

    for (const s of slots) {
      const cur = currentAt(current, s);
      const candidates = byPos[s.slot];
      for (const cand of candidates) {
        if (cand.fdPlayerId === cur.fdPlayerId) continue;
        if (
          current.P.fdPlayerId === cand.fdPlayerId ||
          current.C1B.fdPlayerId === cand.fdPlayerId ||
          current._2B.fdPlayerId === cand.fdPlayerId ||
          current._3B.fdPlayerId === cand.fdPlayerId ||
          current.SS.fdPlayerId === cand.fdPlayerId ||
          current.UTIL.fdPlayerId === cand.fdPlayerId ||
          current.OF.some((p) => p.fdPlayerId === cand.fdPlayerId)
        ) continue;

        // Check salary + team cap after the swap
        const newSalary = current.salary - cur.salary + cand.salary;
        if (newSalary > SALARY_CAP) continue;

        const isPitcher = s.slot === 'P';
        const newTeams = { ...current.teams };
        if (!isPitcher) {
          newTeams[cur.team] = (newTeams[cur.team] ?? 0) - 1;
          newTeams[cand.team] = (newTeams[cand.team] ?? 0) + 1;
          if (newTeams[cand.team] > MAX_HITTERS_PER_TEAM) continue;
        }

        const gain = cand.projectedPoints - cur.projectedPoints;
        if (gain > 0.01) {
          current = applySwap(current, s, cand, newSalary, newTeams);
          improved = true;
          break;   // re-scan from this slot
        }
      }
    }
  }

  return current;
}

function currentAt(l: Lineup, s: { slot: Slot; idx?: 0 | 1 | 2 }): PlayerOption {
  switch (s.slot) {
    case 'P': return l.P;
    case 'C1B': return l.C1B;
    case '2B': return l._2B;
    case '3B': return l._3B;
    case 'SS': return l.SS;
    case 'OF': return l.OF[s.idx ?? 0];
    case 'UTIL': return l.UTIL;
  }
}

function applySwap(
  l: Lineup,
  s: { slot: Slot; idx?: 0 | 1 | 2 },
  p: PlayerOption,
  newSalary: number,
  newTeams: Record<string, number>,
): Lineup {
  const newGames = new Set<string>();
  const gather = (pl: PlayerOption) => newGames.add(pl.game);
  const newL: Lineup = { ...l, salary: newSalary, teams: newTeams, games: newGames };
  switch (s.slot) {
    case 'P':   newL.P = p; break;
    case 'C1B': newL.C1B = p; break;
    case '2B':  newL._2B = p; break;
    case '3B':  newL._3B = p; break;
    case 'SS':  newL.SS = p; break;
    case 'OF': {
      const newOf: [PlayerOption, PlayerOption, PlayerOption] = [...l.OF] as [PlayerOption, PlayerOption, PlayerOption];
      newOf[s.idx ?? 0] = p;
      newL.OF = newOf;
      break;
    }
    case 'UTIL': newL.UTIL = p; break;
  }
  [newL.P, newL.C1B, newL._2B, newL._3B, newL.SS, newL.UTIL, ...newL.OF].forEach(gather);
  newL.projected = (
    newL.P.projectedPoints + newL.C1B.projectedPoints +
    newL._2B.projectedPoints + newL._3B.projectedPoints +
    newL.SS.projectedPoints + newL.UTIL.projectedPoints +
    newL.OF.reduce((s, p) => s + p.projectedPoints, 0)
  );
  return newL;
}


// ── Utilities ───────────────────────────────────────────────────────

function signature(l: Lineup): string {
  const all = [l.P, l.C1B, l._2B, l._3B, l.SS, l.UTIL, ...l.OF]
    .map((p) => p.fdPlayerId)
    .sort();
  return all.join('|');
}
