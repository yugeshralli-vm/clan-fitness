import type { MetadataRoute } from "next";

// Only "/" is real, indexable content — everything else is either auth-gated (redirects to
// sign-in for a logged-out crawler, see src/proxy.ts's isPublicRoute) or invite-specific (/join,
// meant for link-preview unfurling, not general search discovery).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/sign-in",
        "/sign-up",
        "/join",
        "/onboarding",
        "/admin",
        "/logs",
        "/clans/",
        "/profile",
        "/feedback",
        "/api/",
      ],
    },
    sitemap: "https://www.clanfitness.in/sitemap.xml",
  };
}
