import type { MetadataRoute } from "next";

// The landing page is the only public, indexable route today (see robots.ts) — add entries here
// if more public marketing pages are ever added.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.clanfitness.in",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
