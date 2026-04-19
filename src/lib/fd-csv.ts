/**
 * Parser for FanDuel's MLB slate CSV template.
 *
 * The FD template has its columns offset — columns A-I are an empty lineup
 * entry pad, column K onwards contains the player list starting at row 8
 * (1-indexed). The header row is at row 7.
 *
 * We just care about the columns starting at "Player ID + Player Name".
 */

export type FdCsvRow = {
  fdPlayerId: string;
  fdName: string;
  position: string;
  fppg: number | null;
  salary: number;
  game: string;
  team: string;
  opponent: string;
  injuryIndicator: string | null;
  battingOrder: number | null;
  probablePitcher: boolean;
};

/**
 * Parse the FD CSV. Skips preamble rows until it finds the "Player ID + Player Name"
 * header, then parses each subsequent row.
 */
export function parseFdCsv(text: string): FdCsvRow[] {
  const lines = splitCsvLines(text);
  // Find header row by locating the "Player ID + Player Name" token
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].some((c) => c.trim() === 'Player ID + Player Name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not locate FanDuel header row ("Player ID + Player Name").');
  }

  const header = lines[headerIdx].map((c) => c.trim());
  const colIdx = (name: string) => header.indexOf(name);

  const COLS = {
    id: colIdx('Player ID + Player Name'),
    pos: colIdx('Position'),
    fppg: colIdx('FPPG'),
    salary: colIdx('Salary'),
    game: colIdx('Game'),
    team: colIdx('Team'),
    opp: colIdx('Opponent'),
    injury: colIdx('Injury Indicator'),
    bo: colIdx('Batting Order'),
    probable: colIdx('Probable Pitcher'),
    nickname: colIdx('Nickname'),
  };

  if (COLS.id < 0 || COLS.pos < 0 || COLS.salary < 0) {
    throw new Error('CSV missing required columns (Player ID + Player Name / Position / Salary).');
  }

  const rows: FdCsvRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const r = lines[i];
    if (r.length === 0 || !r[COLS.id]) continue;

    // "Player ID + Player Name" is "129171-119340:Tarik Skubal"
    const idRaw = (r[COLS.id] ?? '').trim();
    if (!idRaw.includes(':')) continue;
    const [fdPlayerId, nameFromCombo] = idRaw.split(':', 2);
    const fdName = (r[COLS.nickname] ?? nameFromCombo ?? '').trim();

    const salary = parseInt(r[COLS.salary] ?? '0', 10);
    if (!salary) continue;

    rows.push({
      fdPlayerId: fdPlayerId.trim(),
      fdName,
      position: (r[COLS.pos] ?? '').trim(),
      fppg: parseNum(r[COLS.fppg]),
      salary,
      game:      (r[COLS.game] ?? '').trim(),
      team:      (r[COLS.team] ?? '').trim(),
      opponent:  (r[COLS.opp]  ?? '').trim(),
      injuryIndicator: (r[COLS.injury] ?? '').trim() || null,
      battingOrder:   r[COLS.bo]  ? parseInt(r[COLS.bo], 10) || null : null,
      probablePitcher: (r[COLS.probable] ?? '').trim().toLowerCase() === 'yes',
    });
  }
  return rows;
}

/**
 * Splits CSV text into an array of rows (each an array of cells),
 * correctly handling quoted values with commas / newlines.
 */
export function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') {
        cur.push(field); rows.push(cur); cur = []; field = '';
      } else if (ch === '\r') {
        // CRLF; ignore \r
      } else {
        field += ch;
      }
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.trim());
  return Number.isFinite(n) ? n : null;
}


// ── Team abbreviation normalizer ────────────────────────────────────

/**
 * FanDuel uses some team abbrevs differently from MLB's Stats API.
 * Normalize FD abbrevs so they match our `teams.abbrev` column.
 */
export function normalizeFdTeam(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const a = abbr.toUpperCase().trim();
  const MAP: Record<string, string> = {
    // FD → MLB Stats API
    CWS: 'CWS',   // White Sox
    WSH: 'WSH',
    KC:  'KC',
    SD:  'SD',
    SF:  'SF',
    TB:  'TB',
    AZ:  'AZ',    // sometimes ARI
    ARI: 'AZ',
    ATH: 'OAK',   // FD uses ATH for Oakland / new Athletics
    LAA: 'LAA',
    NYM: 'NYM',
    NYY: 'NYY',
    CHC: 'CHC',
  };
  return MAP[a] ?? a;
}
