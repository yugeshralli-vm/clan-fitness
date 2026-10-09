import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-response";

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
