import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { parseFdCsv, normalizeFdTeam } from '@/lib/fd-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/fd-slate/upload
 *   multipart form with `file` (CSV) OR JSON body { csv: string, date?: 'YYYY-MM-DD' }
 *
 * Parses the FD CSV, stores prices in fd_slate_prices, and fuzzy-matches
 * each FD player to our players.player_id by (name, team).
 *
 * Returns { count, matched, unmatched: [{fdName, team}, ...] }.
 */
export async function POST(req: NextRequest) {
  let csvText = '';
  let slateDate = new Date().toISOString().slice(0, 10);

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const date = form.get('date');
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) slateDate = date;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    csvText = await file.text();
  } else {
    const body = await req.json().catch(() => ({} as { csv?: string; date?: string }));
    if (!body.csv || typeof body.csv !== 'string') {
      return NextResponse.json({ error: 'csv text is required' }, { status: 400 });
    }
    csvText = body.csv;
    if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) slateDate = body.date;
  }

  let rows;
  try {
    rows = parseFdCsv(csvText);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: 'no player rows parsed' }, { status: 400 });
  }

  // Try to auto-detect slate date from the filename/body if the date param was omitted.
  // (Handled implicitly: caller can pass date in the form or JSON body.)

  // ── Match FD players to our players by name + team ───────────────
  // Build a lookup of our players by (lowercased name) → playerId.
  // Also narrow by team when we can.
  const nameKeys = Array.from(new Set(rows.map((r) => r.fdName.toLowerCase())));
  const playersRows = nameKeys.length
    ? await db.execute(sql`
        SELECT player_id, full_name, team_id
        FROM players
        WHERE LOWER(full_name) = ANY(${nameKeys})
      `)
    : { rows: [] } as unknown as { rows: { player_id: number; full_name: string; team_id: number | null }[] };
  const playerByName = new Map<string, { player_id: number; full_name: string; team_id: number | null }[]>();
  const extractedRows = (playersRows as { rows?: { player_id: number; full_name: string; team_id: number | null }[] }).rows
    ?? (playersRows as unknown as { player_id: number; full_name: string; team_id: number | null }[]);
  for (const p of extractedRows) {
    const key = p.full_name.toLowerCase();
    const arr = playerByName.get(key) ?? [];
    arr.push(p);
    playerByName.set(key, arr);
  }

  // Fetch all teams so we can translate abbrev→team_id for team-tiebreak
  const teamRows = await db.execute(sql`SELECT team_id, abbrev FROM teams`);
  const teamAbbrevToId = new Map<string, number>();
  const extractedTeams = (teamRows as { rows?: { team_id: number; abbrev: string | null }[] }).rows
    ?? (teamRows as unknown as { team_id: number; abbrev: string | null }[]);
  for (const t of extractedTeams) {
    if (t.abbrev) teamAbbrevToId.set(t.abbrev.toUpperCase(), t.team_id);
  }

  // ── Upsert each row ──────────────────────────────────────────────
  const unmatched: { fdName: string; team: string }[] = [];
  let matched = 0;

  for (const r of rows) {
    const key = r.fdName.toLowerCase();
    const candidates = playerByName.get(key) ?? [];
    const fdTeam = normalizeFdTeam(r.team);
    const teamId = fdTeam ? teamAbbrevToId.get(fdTeam) : undefined;

    let mpid: number | null = null;
    if (candidates.length === 1) {
      mpid = candidates[0].player_id;
    } else if (candidates.length > 1 && teamId != null) {
      const t = candidates.find((c) => c.team_id === teamId);
      mpid = t?.player_id ?? candidates[0].player_id;
    } else if (candidates.length > 1) {
      // No team to disambiguate — pick lowest ID (usually the veteran).
      mpid = candidates.sort((a, b) => a.player_id - b.player_id)[0].player_id;
    }

    if (mpid != null) matched += 1;
    else unmatched.push({ fdName: r.fdName, team: r.team });

    await db.execute(sql`
      INSERT INTO fd_slate_prices (
        slate_date, fd_player_id, fd_name, position, salary, fppg,
        team, opponent, game, injury_indicator, batting_order, probable_pitcher,
        matched_player_id, uploaded_at
      )
      VALUES (
        ${slateDate}, ${r.fdPlayerId}, ${r.fdName}, ${r.position}, ${r.salary}, ${r.fppg},
        ${r.team}, ${r.opponent}, ${r.game}, ${r.injuryIndicator}, ${r.battingOrder},
        ${r.probablePitcher}, ${mpid}, NOW()
      )
      ON CONFLICT (slate_date, fd_player_id) DO UPDATE SET
        fd_name = EXCLUDED.fd_name,
        position = EXCLUDED.position,
        salary = EXCLUDED.salary,
        fppg = EXCLUDED.fppg,
        team = EXCLUDED.team,
        opponent = EXCLUDED.opponent,
        game = EXCLUDED.game,
        injury_indicator = EXCLUDED.injury_indicator,
        batting_order = EXCLUDED.batting_order,
        probable_pitcher = EXCLUDED.probable_pitcher,
        matched_player_id = EXCLUDED.matched_player_id,
        uploaded_at = NOW()
    `);
  }

  return NextResponse.json({
    slateDate,
    count: rows.length,
    matched,
    unmatched: unmatched.slice(0, 50),   // preview
    totalUnmatched: unmatched.length,
  });
}
