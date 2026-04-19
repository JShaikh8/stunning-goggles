# sports-oracle-ui

Next.js 15 + Tailwind + shadcn/ui frontend for the
[sports-oracle-python](../sports-oracle-python) MLB projections pipeline.
Reads directly from the shared Postgres database via Drizzle.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn/ui (dark-mode-first)
- Drizzle ORM + `postgres` driver
- Recharts for factor radars, spray scatters, calibration plots
- No auth — local tool

## Setup

```bash
cd ~/projects/sports-oracle-ui
npm install
# .env.local has the local Postgres DSN
npm run dev
# open http://localhost:3000
```

The pipeline repo runs Postgres in Docker. If the DB isn't up yet, start it there:

```bash
cd ~/projects/sports-oracle-python
docker compose up -d
python -m db.init_schema
```

## Routes

| Path                        | What                                                      |
| --------------------------- | --------------------------------------------------------- |
| `/slate?date=YYYY-MM-DD`    | Grid of games for a date, NRFI % as hero metric           |
| `/games/[gamePk]`           | Home/away lineups w/ factor pills + starting-pitcher card |
| `/hitters/[playerId]`       | Factor radar, spray chart, splits, similar hitters        |
| `/calibration`              | Projected vs actual DK scatter + daily MAE                |

## Conventions

- All DB queries go through `src/lib/db/queries.ts`. Use `inArray()` from
  Drizzle rather than raw `sql\`ANY(${arr})\`` — the `postgres` driver
  interprets JS arrays differently than psycopg.
- shadcn components live in `src/components/ui/`. Custom components (factor
  pills, charts) sit in `src/components/`.
- Pages use `export const dynamic = 'force-dynamic'` — projections change
  daily and we don't want stale caches.
- Dates are rendered as ISO strings (`YYYY-MM-DD`) to match the pipeline.
