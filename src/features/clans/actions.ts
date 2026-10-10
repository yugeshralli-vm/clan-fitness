"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import {
  createClanFor,
  deleteClanFor,
  joinClanFor,
  leaveClanFor,
  makeAdminFor,
  nudgeMemberFor,
  regenerateInviteCodeFor,
  removeMemberFor,
  renameClanFor,
} from "./mutations";

// Thin wrappers over ./mutations.ts (shared with /api/v1): auth, then the web's own response —
// revalidation, redirects, and throwing where the forms expect it.

export type ClanActionState = { error?: string } | undefined;

export async function createClan(
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const result = await createClanFor(user.id, String(formData.get("name") ?? ""), String(formData.get("description") ?? ""));
  if ("error" in result) return result;

  revalidatePath("/logs");
  redirect(`/clans/${result.clanId}/welcome`);
}

export async function joinClanByInviteCode(
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const result = await joinClanFor(user.id, String(formData.get("inviteCode") ?? ""));
  if ("error" in result) return result;
  if (result.alreadyMember) redirect(`/clans/${result.clanId}`);

  revalidatePath("/logs");
  redirect(`/clans/${result.clanId}/welcome`);
}

export async function leaveClan(clanId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const result = await leaveClanFor(user.id, clanId);
  if ("error" in result) throw new Error(result.error);

  revalidatePath("/logs");
  redirect("/logs");
}

export async function renameClan(
  clanId: string,
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const result = await renameClanFor(user.id, clanId, String(formData.get("name") ?? ""));
  if ("error" in result) return result;

  revalidatePath(`/clans/${clanId}`);
  revalidatePath(`/clans/${clanId}/manage`);
}

export async function deleteClan(
  clanId: string,
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const result = await deleteClanFor(user.id, clanId, String(formData.get("confirmName") ?? ""));
  if ("error" in result) return result;

  revalidatePath("/logs");
  redirect("/logs");
}

export async function removeMember(clanId: string, memberUserId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const result = await removeMemberFor(user.id, clanId, memberUserId);
  if ("error" in result) throw new Error(result.error);

  revalidatePath(`/clans/${clanId}/manage`);
}

export async function makeAdmin(clanId: string, targetUserId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const result = await makeAdminFor(user.id, clanId, targetUserId);
  if ("error" in result) throw new Error(result.error);

  revalidatePath(`/clans/${clanId}/manage`);
}

export async function regenerateInviteCode(clanId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const result = await regenerateInviteCodeFor(user.id, clanId);
  if ("error" in result) throw new Error(result.error);

  revalidatePath(`/clans/${clanId}/manage`);
}

export type NudgeActionState = { error?: string; sent?: boolean } | undefined;

export async function nudgeMember(clanId: string, targetUserId: string): Promise<NudgeActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  return nudgeMemberFor(user, clanId, targetUserId);
}
