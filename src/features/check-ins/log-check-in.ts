import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { checkIns } from "@/db/schema";
import { getDuelStandings, notifyDuelOvertakes } from "@/features/clan-contracts/duels";
import { announceContractCompletions } from "@/features/clan-contracts/moments";
import { getClanMembersForClanIds, getUserClans } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { publishClanEvent } from "@/lib/realtime";
import { getTodaysCheckIn } from "./queries";
import type { CheckInType, FoodCheckInValue, FoodStatus } from "./types";

/**
 * Shared upsert core behind both the web Server Action (src/features/check-ins/actions.ts, which
 * additionally handles FormData parsing and Blob-URL photo validation before calling this) and the
 * mobile /api/v1/logs route (src/app/api/v1/logs/route.ts, which never sets photoUrls — that field
 * exists here only so the web caller can keep sharing this one upsert implementation for food
 * rather than duplicating it for a photo-less variant).
 */
export type DailyCheckInInput = {
  workedOut?: boolean;
  gymNote?: string;
  stepsCount?: number;
  foodStatus?: FoodStatus;
  foodNote?: string;
  photoUrls?: string[];
  thought?: string;
};

/** Same anchor/notify semantics as the original logDailyCheckIn — see notifyClansOfCheckIn below. */
export async function applyDailyCheckIn(
  user: { id: string; name: string; timezone: string },
  input: DailyCheckInInput,
): Promise<{ newlyLoggedTypes: CheckInType[]; anchorCheckInId?: string }> {
  const newlyLoggedTypes: CheckInType[] = [];
  const todaysCheckIns: { id: string; createdAt: Date }[] = [];
  // Only needed when steps change; taken before the write so a lead change can be detected after.
  const duelsBefore = input.stepsCount !== undefined ? await getDuelStandings(user.id) : [];

  const thought = input.thought?.trim().slice(0, 200) || undefined;
  // No delete-when-empty here (unlike gym/food's note fields, which just clear in place) — an
  // already-posted thought may already have reactions/comments attached, so resubmitting with the
  // thought field cleared deliberately leaves the existing row alone rather than deleting it.
  if (thought) {
    const existingThought = await getTodaysCheckIn(user.id, "thought", user.timezone);
    if (existingThought) {
      await db.update(checkIns).set({ value: { text: thought } }).where(eq(checkIns.id, existingThought.id));
      todaysCheckIns.push({ id: existingThought.id, createdAt: existingThought.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({ userId: user.id, type: "thought", value: { text: thought }, visibility: "public_to_clan" })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("thought");
      todaysCheckIns.push(row);
    }
  }

  const existingGym = await getTodaysCheckIn(user.id, "gym", user.timezone);
  if (input.workedOut || existingGym) {
    const gymNote = input.gymNote?.trim() || undefined;
    if (existingGym) {
      await db.update(checkIns).set({ value: { note: gymNote } }).where(eq(checkIns.id, existingGym.id));
      todaysCheckIns.push({ id: existingGym.id, createdAt: existingGym.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({ userId: user.id, type: "gym", value: { note: gymNote }, visibility: "public_to_clan" })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("gym");
      todaysCheckIns.push(row);
    }
  }

  if (input.stepsCount !== undefined) {
    const count = input.stepsCount;
    const existingSteps = await getTodaysCheckIn(user.id, "steps", user.timezone);
    if (existingSteps) {
      await db.update(checkIns).set({ value: { count } }).where(eq(checkIns.id, existingSteps.id));
      todaysCheckIns.push({ id: existingSteps.id, createdAt: existingSteps.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({ userId: user.id, type: "steps", value: { count }, visibility: "public_to_clan" })
        .returning({ id: checkIns.id, createdAt: checkIns.createdAt });
      newlyLoggedTypes.push("steps");
      todaysCheckIns.push(row);
    }
  }

  const hasFoodStatus = input.foodStatus !== undefined;
  const photoUrls = input.photoUrls ?? [];
  const hasPhoto = photoUrls.length > 0;
  // A photo can be logged on its own — this block runs whenever either is present, not just on
  // hasFoodStatus (mobile callers never set photoUrls, so this is equivalent to hasFoodStatus for
  // them — identical to a web user submitting the form with no photos).
  if (hasFoodStatus || hasPhoto) {
    const foodNote = input.foodNote?.trim() || undefined;
    const existingFood = await getTodaysCheckIn(user.id, "food", user.timezone);
    if (existingFood) {
      const existingValue = existingFood.value as FoodCheckInValue;
      await db
        .update(checkIns)
        .set({ value: { status: hasFoodStatus ? input.foodStatus : existingValue.status, note: foodNote, photoUrls } })
        .where(eq(checkIns.id, existingFood.id));
      todaysCheckIns.push({ id: existingFood.id, createdAt: existingFood.createdAt });
    } else {
      const [row] = await db
        .insert(checkIns)
        .values({
          userId: user.id,
          type: "food",
          value: { status: hasFoodStatus ? input.foodStatus : undefined, note: foodNote, photoUrls },
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
  // Every submission, not just newly logged types — an edit (more steps, a new photo) changes the
  // feed card and can complete a contract just the same.
  after(async () => {
    const clanIds = (await getUserClans(user.id)).map((c) => c.clan.id);
    await publishClanEvent(clanIds, "feed_post", user.id);
  });
  after(() => notifyDuelOvertakes(user, duelsBefore));
  after(() => announceContractCompletions(user));

  return { newlyLoggedTypes, anchorCheckInId };
}

/**
 * Notifies every member across every clan the actor is currently in, deduped so someone sharing
 * 2+ clans with the actor isn't notified twice. anchorCheckInId must be the *oldest* of today's
 * check-ins, matching the feed's same-day grouping anchor (see groupByUserAndDay) — that id is
 * stable for the rest of the day regardless of what gets added later, which is also what
 * ReactionBar/CommentSheet are bound to.
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
      notifyUser(userId, { type: "check_in", title: `${actorName} checked in`, body: `Logged: ${label}`, url, checkInId: anchorCheckInId }),
    ),
  );
}
