"use server";

import { redirect } from "next/navigation";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { deleteAccount } from "./delete-account";

export type DeleteAccountState = { error?: string } | undefined;

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

export async function deleteMyAccount(_prevState: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (String(formData.get("confirm") ?? "").trim() !== DELETE_ACCOUNT_CONFIRMATION) {
    return { error: `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm.` };
  }

  try {
    await deleteAccount(user.id);
  } catch (error) {
    console.error("account deletion failed", error);
    return { error: "Couldn't finish deleting your account. Please try again." };
  }
  // The Clerk user is gone, so this lands signed out on the landing page.
  redirect("/");
}
