import { getAllClansForAdmin } from "@/features/admin";
import { getClanMembersForClanIds } from "@/features/clans";
import { startOfWeek } from "@/features/check-ins";
import { notifyUser } from "@/features/notifications/send";
import { generateWeeklyRecap } from "@/features/system-posts";

export const maxDuration = 60;

// Runs Sunday 10:00 IST (see vercel.json's "30 4 * * 0" — 04:30 UTC). Summarizes the week that
// just ended 2 hours earlier at Sunday 08:00 IST (startOfWeek()'s new boundary — see
// check-ins/queries.ts). Idempotent (generateWeeklyRecap onConflictDoNothing's on the clan+week
// unique index), so re-invoking this manually or via a retried cron run is always safe.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const end = startOfWeek();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const clans = await getAllClansForAdmin();

  // Promise.allSettled, not Promise.all — Vercel Cron doesn't retry a failed invocation, so one
  // clan's transient error (e.g. a delivery failure) shouldn't stop the rest from getting posted.
  const results = await Promise.allSettled(
    clans.map(async (clan) => {
      const post = await generateWeeklyRecap(clan.id, { start, end });
      if (!post) return { clanId: clan.id, clanName: clan.name, posted: false };

      const members = await getClanMembersForClanIds([clan.id]);
      const recipientIds = [...new Set(members.map((member) => member.user.id))];
      await Promise.all(
        recipientIds.map((userId) =>
          notifyUser(userId, {
            type: "weekly_recap",
            title: "This week's Top 3 & Wall of Shame are up 🏆",
            body: `See how ${clan.name} did this week.`,
            url: `/clans/${clan.id}`,
          }),
        ),
      );
      return { clanId: clan.id, clanName: clan.name, posted: true, recipients: recipientIds.length };
    }),
  );

  const summary = results.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { clanId: clans[i].id, clanName: clans[i].name, posted: false, error: String(result.reason) },
  );

  return Response.json({ weekStart: start, weekEnd: end, processed: clans.length, summary });
}
