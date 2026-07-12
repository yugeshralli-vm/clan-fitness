"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { checkIns, reactions } from "@/db/schema";
import { getClanMembership } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { getReactionsForCheckIns, getReactionsForSystemPosts } from "./queries";
import type { ReactionSummary } from "./types";

export async function toggleReaction(
  checkInId: string,
  clanId: string,
  emoji: string,
): Promise<{ summary: ReactionSummary } | { error: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!(await getClanMembership(user.id, clanId))) return { error: "Not a member of this clan." };

  const [checkIn] = await db
    .select({ userId: checkIns.userId })
    .from(checkIns)
    .where(eq(checkIns.id, checkInId));
  if (!checkIn) return { error: "Check-in not found." };

  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.checkInId, checkInId),
        eq(reactions.clanId, clanId),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, emoji),
      ),
    );

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
  } else {
    await db.insert(reactions).values({ checkInId, clanId, userId: user.id, emoji });
    if (checkIn.userId !== user.id) {
      after(() =>
        notifyUser(checkIn.userId, {
          type: "reaction",
          title: `${user.name} reacted ${emoji} to your check-in`,
          body: "Tap to see it.",
          url: `/clans/${clanId}`,
          checkInId,
        }),
      );
    }
  }

  revalidatePath(`/clans/${clanId}`);

  const summaries = await getReactionsForCheckIns([checkInId], clanId, user.id);
  return { summary: summaries[checkInId] ?? {} };
}

/** Reacting to a system post (see src/features/system-posts) — simpler than toggleReaction since
 * there's no human author to skip-self-react against or notify. */
export async function toggleSystemPostReaction(
  systemPostId: string,
  clanId: string,
  emoji: string,
): Promise<{ summary: ReactionSummary } | { error: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!(await getClanMembership(user.id, clanId))) return { error: "Not a member of this clan." };

  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.systemPostId, systemPostId),
        eq(reactions.clanId, clanId),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, emoji),
      ),
    );

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
  } else {
    await db.insert(reactions).values({ systemPostId, clanId, userId: user.id, emoji });
  }

  revalidatePath(`/clans/${clanId}`);

  const summaries = await getReactionsForSystemPosts([systemPostId], clanId, user.id);
  return { summary: summaries[systemPostId] ?? {} };
}
