import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserClans } from "@/features/clans";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Clan Fitness",
  description:
    "Track gym days, steps, and food with a small group of people who'll actually notice if you skip.",
  url: "https://www.clanfitness.in",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, iOS, Android",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const clans = await getUserClans(userId);
    redirect(clans.length > 0 ? "/logs" : "/onboarding");
  }

  return (
    <main className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <section className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, no benefit from next/image's raster pipeline */}
        <img src="/logo/clan-fitness-logo.svg" alt="Clan Fitness" className="h-16 w-auto" />
        <p className="max-w-md text-foreground-secondary">
          Track gym days, steps, and food with a small group of people who&apos;ll actually notice
          if you skip.
        </p>
        <div className="flex gap-3">
          <Link href="/sign-up">
            <Button>Get started</Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-md grid-cols-3 gap-3 px-6 pb-10 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl" aria-hidden>
            💪
          </span>
          <p className="text-xs text-foreground-tertiary">Log gym, steps &amp; food</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl" aria-hidden>
            🔥
          </span>
          <p className="text-xs text-foreground-tertiary">Streaks &amp; weekly leaderboard</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl" aria-hidden>
            🔔
          </span>
          <p className="text-xs text-foreground-tertiary">Nudges keep your clan honest</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-sm px-6 pb-16">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
          What your clan sees
        </p>
        <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface p-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground-secondary"
            aria-hidden
          >
            M
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Maya</span>
              <span className="text-xs text-foreground-muted">7:42 AM</span>
            </div>
            <p className="text-sm text-foreground-secondary">👟 Logged 11,204 steps</p>
            <span className="w-fit rounded-full border border-surface-border px-2 py-0.5 text-xs text-foreground-tertiary">
              🔥 3
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
