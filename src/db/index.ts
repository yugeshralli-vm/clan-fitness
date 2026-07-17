import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Deliberately staying on neon-http rather than the pooled neon-serverless driver: measured
// directly against the live DB, a pooled connection makes Promise.all-style concurrent queries
// ~3x SLOWER (each concurrent call forces a fresh WebSocket handshake) since Postgres
// connections process one query at a time — there's no multiplexing to parallelize over. This
// codebase fetches data with Promise.all throughout (see (app)/layout.tsx and every page), and
// that pattern is exactly what neon-http is good at: every query is an independent, stateless
// HTTPS request, so concurrent queries genuinely run concurrently. Don't revisit this without
// also rewriting those call sites to sequential awaits — see project memory for the numbers.
type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | undefined;

function getDb(): Database {
  if (!instance) {
    instance = drizzle(process.env.DATABASE_URL!, { schema });
  }
  return instance;
}

// Constructed lazily, on first real query, not at module-evaluation time. Next's "collecting page
// data" build step imports every route module to statically analyze it — including routes that
// only touch the DB inside their handler (e.g. api/cron/weekly-recap) — without ever calling that
// handler. An eager `drizzle(...)` here ran at import time regardless, so any transient hiccup
// constructing the Neon client during that build-time import (seen repeatedly with a restored
// build cache, cause unconfirmed) failed the whole production build. This Proxy defers all of
// that to the first actual query, which only ever happens inside a real request.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
