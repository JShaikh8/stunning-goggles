import type { Boxscore, BoxscorePlayer } from '@/lib/mlb-live';

function batters(players: Record<string, BoxscorePlayer>): BoxscorePlayer[] {
  return Object.values(players)
    .filter((p) => p.stats?.batting && (p.stats.batting.atBats ?? 0) >= 0)
    .filter((p) => p.battingOrder) // only actual starters/subs, not DNP
    .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder));
}

function pitchers(players: Record<string, BoxscorePlayer>): BoxscorePlayer[] {
  return Object.values(players)
    .filter((p) => p.stats?.pitching?.inningsPitched);
}

export function BoxscoreBlock({
  boxscore,
  homeAbbr,
  awayAbbr,
}: {
  boxscore: Boxscore;
  homeAbbr: string | null;
  awayAbbr: string | null;
}) {
  const home = boxscore.teams?.home?.players ?? {};
  const away = boxscore.teams?.away?.players ?? {};

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TeamBox label={awayAbbr ?? 'AWAY'} bats={batters(away)} pits={pitchers(away)} />
      <TeamBox label={homeAbbr ?? 'HOME'} bats={batters(home)} pits={pitchers(home)} />
    </div>
  );
}

function TeamBox({
  label,
  bats,
  pits,
}: {
  label: string;
  bats: BoxscorePlayer[];
  pits: BoxscorePlayer[];
}) {
  return (
    <div className="rounded-xl border border-hairline bg-[var(--surface-1)]">
      <div className="border-b border-hairline px-5 py-3">
        <div className="h-section">{label} box</div>
      </div>

      <div className="p-4">
        <div className="h-section mb-2">Batting</div>
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1 pr-2">Player</th>
              <th className="py-1 pr-2 text-right">AB</th>
              <th className="py-1 pr-2 text-right">R</th>
              <th className="py-1 pr-2 text-right">H</th>
              <th className="py-1 pr-2 text-right">HR</th>
              <th className="py-1 pr-2 text-right">RBI</th>
              <th className="py-1 pr-2 text-right">BB</th>
              <th className="py-1 text-right">K</th>
            </tr>
          </thead>
          <tbody>
            {bats.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-zinc-600">Game hasn&apos;t started</td>
              </tr>
            ) : bats.map((p) => {
              const b = p.stats?.batting ?? {};
              return (
                <tr key={p.person.id} className="border-t border-hairline/60">
                  <td className="py-1 pr-2 text-zinc-200">{p.person.fullName}</td>
                  <td className="py-1 pr-2 text-right text-zinc-300">{b.atBats ?? '—'}</td>
                  <td className="py-1 pr-2 text-right text-zinc-300">{b.runs ?? 0}</td>
                  <td className="py-1 pr-2 text-right text-zinc-100 font-semibold">{b.hits ?? 0}</td>
                  <td className="py-1 pr-2 text-right text-oracle-amber">{b.homeRuns ?? 0}</td>
                  <td className="py-1 pr-2 text-right text-zinc-300">{b.rbi ?? 0}</td>
                  <td className="py-1 pr-2 text-right text-oracle-sky">{b.baseOnBalls ?? 0}</td>
                  <td className="py-1 text-right text-oracle-rose">{b.strikeOuts ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pits.length > 0 && (
        <div className="border-t border-hairline p-4">
          <div className="h-section mb-2">Pitching</div>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-1 pr-2">Player</th>
                <th className="py-1 pr-2 text-right">IP</th>
                <th className="py-1 pr-2 text-right">H</th>
                <th className="py-1 pr-2 text-right">R</th>
                <th className="py-1 pr-2 text-right">ER</th>
                <th className="py-1 pr-2 text-right">BB</th>
                <th className="py-1 pr-2 text-right">K</th>
                <th className="py-1 text-right">P</th>
              </tr>
            </thead>
            <tbody>
              {pits.map((p) => {
                const pp = p.stats?.pitching ?? {};
                return (
                  <tr key={p.person.id} className="border-t border-hairline/60">
                    <td className="py-1 pr-2 text-zinc-200">{p.person.fullName}</td>
                    <td className="py-1 pr-2 text-right text-zinc-100 font-semibold">{pp.inningsPitched ?? '—'}</td>
                    <td className="py-1 pr-2 text-right text-zinc-300">{pp.hits ?? 0}</td>
                    <td className="py-1 pr-2 text-right text-zinc-300">{pp.runs ?? 0}</td>
                    <td className="py-1 pr-2 text-right text-oracle-rose">{pp.earnedRuns ?? 0}</td>
                    <td className="py-1 pr-2 text-right text-zinc-300">{pp.baseOnBalls ?? 0}</td>
                    <td className="py-1 pr-2 text-right text-oracle-green">{pp.strikeOuts ?? 0}</td>
                    <td className="py-1 text-right text-zinc-500">{pp.pitchesThrown ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
