import { getAllClansForAdmin } from "@/features/admin";
import { resolveContractsForClan } from "@/features/clan-contracts/resolve";
import { userDayKey } from "@/lib/timezone-date";

export const maxDuration = 60;

// Runs daily at 00:00 IST (see vercel.json's "30 18 * * *" — 18:30 UTC), right at the clan-day
// boundary, to finalize the day that just ended. Idempotent (a claim only resolves once its
// status moves out of "claimed"), so a retried/duplicate cron run is safe.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayKey = userDayKey("Asia/Kolkata", yesterday);

  const clans = await getAllClansForAdmin();

  // Promise.allSettled, not Promise.all — Vercel Cron doesn't retry a failed invocation, so one
  // clan's transient error shouldn't stop the rest from resolving.
  const results = await Promise.allSettled(clans.map((clan) => resolveContractsForClan(clan.id, dayKey)));

  const summary = results.map((result, i) =>
    result.status === "fulfilled" ? result.value : { clanId: clans[i].id, dayKey, error: String(result.reason) },
  );

  return Response.json({ dayKey, processed: clans.length, summary });
}
