"use server";

import { auth } from "@clerk/nextjs/server";
import { getUserClans } from "@/features/clans/queries";
import { signRealtimeToken } from "@/lib/realtime";

/** Fresh signed token for the realtime socket, covering every clan the user is in right now.
 * Fetched on every (re)connect since tokens are short-lived. Null when signed out or when the
 * realtime server isn't configured. */
export async function getRealtimeToken(): Promise<{ token: string; clanIds: string[] } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const clanIds = (await getUserClans(userId)).map((m) => m.clan.id);
  const token = signRealtimeToken(userId, clanIds);
  return token ? { token, clanIds } : null;
}
