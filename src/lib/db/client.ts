import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Singleton across hot reloads in dev and across concurrent requests in prod.
const globalForDb = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
  drizzle?: ReturnType<typeof drizzle>;
};

function getDb() {
  if (globalForDb.drizzle) return globalForDb.drizzle;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // In production: throw at first query, not at import time, so Next.js
    // build succeeds even if the env var isn't injected during build steps.
    throw new Error(
      'DATABASE_URL is not set. Add it to .env.local locally, or to the ' +
      'service environment in production.',
    );
  }

  const client = globalForDb.pg ?? postgres(connectionString, {
    max: 5,
    // Render Postgres requires SSL; postgres-js auto-detects from the URL.
    ssl: process.env.DATABASE_URL?.includes('render.com') ? 'require' : undefined,
  });
  const d = drizzle(client, { schema });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pg = client;
    globalForDb.drizzle = d;
  }
  return d;
}

// Proxy object — access triggers lazy init so module-level imports don't
// throw during `next build` when DATABASE_URL is missing.
export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop: string | symbol, _receiver) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
