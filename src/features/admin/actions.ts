"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appConfig, broadcastMessages } from "@/db/schema";
import { getClanMembersForClanIds } from "@/features/clans";
import { notifyUser } from "@/features/notifications/send";
import { isAdminUser } from "./auth";
import type { ConfigKey } from "./config";
import { getAllClansForAdmin, getAllUsersForAdmin } from "./queries";

export type AdminActionState = { error?: string } | undefined;

export async function updateAppConfig(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await isAdminUser())) return { error: "Not authorized." };

  const stepWeight = Number(formData.get("stepWeight"));
  const streakWeight = Number(formData.get("streakWeight"));
  const gymWeight = Number(formData.get("gymWeight"));
  if (![stepWeight, streakWeight, gymWeight].every((w) => Number.isFinite(w) && w >= 0 && w <= 1)) {
    return { error: "Each weight must be a number between 0 and 1." };
  }
  const weightSum = stepWeight + streakWeight + gymWeight;
  if (Math.abs(weightSum - 1) > 0.01) {
    return { error: `Step, streak, and gym weights should add up to 1 (currently ${weightSum.toFixed(2)}).` };
  }

  const streakCapDays = Number(formData.get("streakCapDays"));
  if (!Number.isInteger(streakCapDays) || streakCapDays < 1 || streakCapDays > 30) {
    return { error: "Streak cap must be a whole number of days between 1 and 30." };
  }

  const defaultWeeklyGymTarget = Number(formData.get("defaultWeeklyGymTarget"));
  if (!Number.isInteger(defaultWeeklyGymTarget) || defaultWeeklyGymTarget < 1 || defaultWeeklyGymTarget > 7) {
    return { error: "Default gym target must be a whole number between 1 and 7." };
  }

  const defaultDailyStepsTarget = Number(formData.get("defaultDailyStepsTarget"));
  if (!Number.isInteger(defaultDailyStepsTarget) || defaultDailyStepsTarget < 1) {
    return { error: "Default steps target must be a positive whole number." };
  }

  const values: Record<ConfigKey, number> = {
    stepWeight,
    streakWeight,
    gymWeight,
    streakCapDays,
    defaultWeeklyGymTarget,
    defaultDailyStepsTarget,
  };

  await Promise.all(
    Object.entries(values).map(([key, value]) =>
      db
        .insert(appConfig)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: appConfig.key, set: { value: String(value), updatedAt: new Date() } }),
    ),
  );

  revalidatePath("/admin");
  revalidatePath("/clans/[clanId]/manage", "page");
}

export type BroadcastActionState = { error?: string; sentCount?: number } | undefined;

export async function sendBroadcast(
  _prevState: BroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  if (!(await isAdminUser())) return { error: "Not authorized." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const targetType = formData.get("targetType") === "user" ? ("user" as const) : ("clan" as const);

  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Message is required." };

  let recipientIds: string[];
  let targetNames: string[];

  if (targetType === "user") {
    const userIds = formData.getAll("userIds").map(String);
    if (userIds.length === 0) return { error: "Select at least one person." };
    const allUsers = await getAllUsersForAdmin();
    targetNames = allUsers.filter((user) => userIds.includes(user.id)).map((user) => user.name);
    recipientIds = [...new Set(userIds)];
  } else {
    const clanIds = formData.getAll("clanIds").map(String);
    if (clanIds.length === 0) return { error: "Select at least one clan." };
    const [allClans, members] = await Promise.all([getAllClansForAdmin(), getClanMembersForClanIds(clanIds)]);
    targetNames = allClans.filter((clan) => clanIds.includes(clan.id)).map((clan) => clan.name);
    // A member of more than one selected clan gets exactly one notification, not one per clan.
    recipientIds = [...new Set(members.map((member) => member.user.id))];
  }

  await Promise.all(
    recipientIds.map((userId) => notifyUser(userId, { type: "broadcast", title, body })),
  );

  await db.insert(broadcastMessages).values({ title, body, targetType, targetNames, recipientCount: recipientIds.length });

  revalidatePath("/admin");
  return { sentCount: recipientIds.length };
}
