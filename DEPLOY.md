# Deploying the UI to Render

This repo hosts the Next.js frontend. The database + nightly pipeline live
in [sports-oracle-python](../sports-oracle-python). Deploy that first —
the UI is a **read-only** client.

See the authoritative guide at
[../sports-oracle-python/DEPLOY.md](../sports-oracle-python/DEPLOY.md).

## TL;DR

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect this repo.
3. The blueprint provisions one web service (`sports-oracle-ui`).
4. In the new service's Environment tab, paste the same `DATABASE_URL`
   you used for the Python pipeline's managed Postgres.
5. Trigger a Manual Deploy.

Live at `https://sports-oracle-ui.onrender.com/slate`.

## Local dev still works

The production code path is identical — just populate `.env.local` locally
and the same Drizzle client connects.
