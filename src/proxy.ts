import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Shared invite links must be reachable while signed out — the page itself already redirects
  // to sign-in (preserving the invite code via redirect_url) when there's no session. Leaving
  // this to auth.protect() instead breaks link-preview crawlers (WhatsApp/iMessage/etc.), which
  // don't send normal browser Accept headers — protect() responds to those with a 404 rather than
  // a redirect, so the shared link's preview showed "404: This page could not be found".
  "/join(.*)",
  // PWA manifest icons — extensionless, so unlike .webmanifest they aren't excluded by the
  // matcher below, and browsers fetch them unauthenticated during install-eligibility checks.
  "/icon-192",
  "/icon-512",
  "/icon-512-maskable",
  "/apple-icon",
  // Search-engine crawlers and link-preview bots (which unfurl og:image) have no Clerk session —
  // .txt/.xml aren't excluded by the matcher below, and /opengraph-image is extensionless like the
  // icon routes above, so all three need an explicit exemption or they'd 404/redirect for crawlers.
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  // Google's Digital Asset Links verifier fetches this unauthenticated to confirm the TWA
  // (Play Store wrapper) owns this domain — a redirect to sign-in here fails TWA verification.
  "/.well-known/assetlinks.json",
  // Vercel Cron invocations have no Clerk session (machine-to-machine, authenticated by their own
  // CRON_SECRET bearer-token check inside the route handler) — without this, auth.protect() 404s
  // the request before it ever reaches that check, silently breaking every cron route.
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
