import Link from 'next/link';
import { getBattersSlate, getPitchersSlate, getTodayGameDates } from '@/lib/db/queries';
import { BattersTable } from '@/components/batters-table';
import { PitchersTable } from '@/components/pitchers-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const dynamic = 'force-dynamic';

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const availableDates = await getTodayGameDates();
  const date =
    params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);

  const [batters, pitchers] = await Promise.all([
    getBattersSlate(date),
    getPitchersSlate(date),
  ]);

  // Totals for the header
  const factorSum = batters.reduce((s, r) => s + (r.dkPts ?? 0), 0);
  const mlSum = batters.reduce((s, r) => s + (r.mlDkPts ?? 0), 0);

  return (
    <div className="min-h-screen">
      <div className="border-b border-hairline bg-[var(--surface-0)] px-6 pb-6 pt-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="h-section">Players</div>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-50">
              Slate research
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-500">
              <span>{date}</span>
              <span className="text-zinc-700">·</span>
              <span>
                <span className="text-zinc-200">{batters.length}</span> batters
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                <span className="text-zinc-200">{pitchers.length}</span> pitchers
              </span>
              {batters.length > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span>
                    factor Σ <span className="text-zinc-200">{factorSum.toFixed(0)}</span>
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    ml Σ <span className="text-oracle-green">{mlSum.toFixed(0)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase text-zinc-500">
            <span className="mr-1 text-zinc-600">recent:</span>
            {availableDates.slice(0, 8).map((d) => {
              const [, m, dd] = d.split('-');
              const active = d === date;
              return (
                <Link
                  key={d}
                  href={`/players?date=${d}`}
                  className={
                    active
                      ? 'rounded bg-oracle-green/15 px-2 py-1 text-oracle-green'
                      : 'rounded px-2 py-1 text-zinc-500 hover:bg-[var(--surface-2)] hover:text-zinc-200'
                  }
                >
                  {m}/{dd}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        <Tabs defaultValue="batters">
          <TabsList className="mb-4">
            <TabsTrigger value="batters">Batters · {batters.length}</TabsTrigger>
            <TabsTrigger value="pitchers">Pitchers · {pitchers.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="batters">
            <BattersTable rows={batters} />
          </TabsContent>
          <TabsContent value="pitchers">
            <PitchersTable rows={pitchers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
