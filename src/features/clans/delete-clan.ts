import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clanContractClaims,
  clanMemberships,
  clanMessages,
  clans,
  comments,
  reactions,
  systemPosts,
} from "@/db/schema";

/**
 * Deletes a clan and every row that belongs to it. None of these foreign keys cascade and the Neon
 * HTTP driver has no transactions, so children go first, in dependency order: reactions and
 * comments (which can point at system posts and chat messages) → system posts → chat messages →
 * contract claims → memberships → the clan. Check-ins are untouched: they have no clan of their
 * own (see schema.ts), so members keep their history.
 */
export async function deleteClanData(clanId: string) {
  await db.delete(reactions).where(eq(reactions.clanId, clanId));
  await db.delete(comments).where(eq(comments.clanId, clanId));
  await db.delete(systemPosts).where(eq(systemPosts.clanId, clanId));
  await db.delete(clanMessages).where(eq(clanMessages.clanId, clanId));
  await db.delete(clanContractClaims).where(eq(clanContractClaims.clanId, clanId));
  await db.delete(clanMemberships).where(eq(clanMemberships.clanId, clanId));
  await db.delete(clans).where(eq(clans.id, clanId));
}
