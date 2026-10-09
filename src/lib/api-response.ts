import { NextResponse } from "next/server";
import { getOrSyncCurrentUser } from "./current-user";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Shared 401 guard for every /api/v1/** route (see src/proxy.ts for why these routes are exempted
 * from clerkMiddleware's auth.protect() and rely on this instead). Tagged-union return so callers
 * write `const r = await requireApiUser(); if ("error" in r) return r.error;` instead of repeating
 * the null-check/401 body in every route.
 */
export async function requireApiUser() {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: apiError(401, "Not signed in.") } as const;
  return { user } as const;
}
