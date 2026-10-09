import { NextResponse } from "next/server";
import { deleteAccount } from "@/features/account/delete-account";
import { apiError, requireApiUser } from "@/lib/api-response";

export async function GET() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  return NextResponse.json({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    avatarUrl: r.user.avatarUrl,
  });
}

/** Account deletion from the Android app (Play Store requires it in-app). Same as the web profile's. */
export async function DELETE() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  try {
    await deleteAccount(r.user.id);
  } catch (error) {
    console.error("account deletion failed", error);
    return apiError(500, "Couldn't finish deleting your account. Please try again.");
  }
  return new NextResponse(null, { status: 204 });
}
