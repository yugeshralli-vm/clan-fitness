"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { checkIns } from "@/db/schema";
import { getClanMembersForClanIds, getUserClans } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { getTodaysCheckIn } from "./queries";
import type { CheckInType, FoodCheckInValue, FoodStatus } from "./types";

/**
 * Notifies every member across every clan the actor is currently in, deduped so someone sharing
 * 2+ clans with the actor isn't notified twice. `anchorCheckInId` lets the notification deep-link
 * straight to that day's card instead of just the clan feed — it must be the *oldest* of today's
 * check-ins (gym/steps/food), since the feed groups a user's same-day check-ins into one card
 * keyed by its oldest entry (see groupByUserAndDay) — that id is stable for the rest of the day
 * regardless of what gets added later, which is also what ReactionBar/CommentSheet are bound to.
 * Using the newest instead (as this used to) meant adding a new check-in type later the same day
 * silently orphaned any reactions/comments already made on that day's card.
 */
async function notifyClansOfCheckIn(
  actorId: string,
  actorName: string,
  types: CheckInType[],
  anchorCheckInId?: string,
) {
  if (types.length === 0) return;

  const actorClans = await getUserClans(actorId);
  const clanIds = actorClans.map((c) => c.clan.id);
  if (clanIds.length === 0) return;

  const members = await getClanMembersForClanIds(clanIds);
  const recipientIds = new Set(members.map((m) => m.user.id).filter((id) => id !== actorId));

  const label = types.join(", ");
  const url = `/clans/${clanIds[0]}`;
  await Promise.all(
    [...recipientIds].map((userId) =>
      notifyUser(userId, {
        type: "check_in",
        title: `${actorName} checked in`,
        body: `Logged: ${label}`,
        url,
        checkInId: anchorCheckInId,
      }),
    ),
  );
}

export type CheckInActionState = { error?: string } | undefined;

// Photos are uploaded client-direct to Vercel Blob (see src/app/api/check-ins/upload/route.ts) —
// this Server Action only ever receives the resulting URLs, never raw file bytes. This check
// isn't a security boundary (next/image's own remotePatterns allowlist already refuses to render
// an unlisted host, so a forged value would at worst show a broken image), just a cheap sanity
// filter against a hand-crafted form submission.
const BLOB_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export async function logDailyCheckIn(
  _prevState: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const stepsRaw = String(formData.get("count") ?? "").trim();
  const count = stepsRaw ? Number(stepsRaw) : undefined;
  if (count !== undefined && (!Number.isFinite(count) || count < 0)) {
    return { error: "Enter a valid step count." };
  }

  const status = String(formData.get("status") ?? "") as FoodStatus;
  const hasFoodStatus = ["yes", "no", "partial"].includes(status);
  const photoUrls = formData
    .getAll("photoUrls")
    .filter((v): v is string => typeof v === "string" && BLOB_URL_PATTERN.test(v))
    .slice(0, 3);
  const hasPhoto = photoUrls.length > 0;

  const workedOut = formData.get("workedOut") === "on";
  const thought = String(formData.get("thought") ?? "").trim().slice(0, 200) || undefined;
  const newlyLoggedTypes: CheckInType[] = [];
  // Every one of today's check-ins for this user (pre-existing or just written), so the
  // notification anchor below can be computed as the oldest of them — see the comment on
  // notifyClansOfCheckIn for why it must be oldest, not whichever this submission touched last.
  const todaysCheckIns: { id: string; createdAt: Date }[] = [];

  // No delete-when-empty here (unlike gym/food's note fields, which just clear in place) — an
  // already-posted thought may already have reactions/comments attached, so resubmitting the form
  // with the thought field cleared deliberately leaves the existing one alone rather than deleting
  // the row. A real "remove my thought" affordance would need cascade handling; not in scope yet.
  if (thought) {
    const existingThought = await getTodaysCheckIn(user.id, "thought", user.timezone);
    if (existingThought) {
      await db.update(checkIns).set({ value: { text: thought } }).where(eq(checkIns.id, existingThought.id));
      todaysCheckIns.push({ id: existingThought.id, createdAt: existingThought.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({
          userId: user.id,
          type: "thought",
          value: { text: thought },
          visibility: "public_to_clan",
        })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("thought");
      todaysCheckIns.push(row);
    }
  }

  const existingGym = await getTodaysCheckIn(user.id, "gym", user.timezone);
  if (workedOut || existingGym) {
    const gymNote = String(formData.get("gymNote") ?? "").trim() || undefined;
    if (existingGym) {
      await db.update(checkIns).set({ value: { note: gymNote } }).where(eq(checkIns.id, existingGym.id));
      todaysCheckIns.push({ id: existingGym.id, createdAt: existingGym.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({
          userId: user.id,
          type: "gym",
          value: { note: gymNote },
          visibility: "public_to_clan",
        })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("gym");
      todaysCheckIns.push(row);
    }
  }

  if (count !== undefined) {
    const existingSteps = await getTodaysCheckIn(user.id, "steps", user.timezone);
    if (existingSteps) {
      await db.update(checkIns).set({ value: { count } }).where(eq(checkIns.id, existingSteps.id));
      todaysCheckIns.push({ id: existingSteps.id, createdAt: existingSteps.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({
          userId: user.id,
          type: "steps",
          value: { count },
          visibility: "public_to_clan",
        })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("steps");
      todaysCheckIns.push(row);
    }
  }

  // A photo can be logged on its own — it no longer requires also answering the nutrition
  // question, so this block runs whenever either is present, not just on hasFoodStatus.
  if (hasFoodStatus || hasPhoto) {
    const foodNote = String(formData.get("foodNote") ?? "").trim() || undefined;

    const existingFood = await getTodaysCheckIn(user.id, "food", user.timezone);
    if (existingFood) {
      const existingValue = existingFood.value as FoodCheckInValue;
      // No merge with the previous value's photos needed: the client always sends the complete
      // desired set (existing photos it kept, minus any it removed, plus any newly uploaded), so
      // this can just overwrite — which also means removing every photo now genuinely works.
      await db
        .update(checkIns)
        .set({ value: { status: hasFoodStatus ? status : existingValue.status, note: foodNote, photoUrls } })
        .where(eq(checkIns.id, existingFood.id));
      todaysCheckIns.push({ id: existingFood.id, createdAt: existingFood.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({
          userId: user.id,
          type: "food",
          value: { status: hasFoodStatus ? status : undefined, note: foodNote, photoUrls },
          visibility: "public_to_clan",
        })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("food");
      todaysCheckIns.push(row);
    }
  }

  const anchorCheckInId = todaysCheckIns.reduce(
    (oldest, c) => (!oldest || c.createdAt < oldest.createdAt ? c : oldest),
    null as { id: string; createdAt: Date } | null,
  )?.id;

  after(() => notifyClansOfCheckIn(user.id, user.name, newlyLoggedTypes, anchorCheckInId));

  revalidatePath("/logs");
}
