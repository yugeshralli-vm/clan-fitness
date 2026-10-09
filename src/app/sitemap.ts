import type { MetadataRoute } from "next";

// Public, indexable routes (see robots.ts) — add entries here if more public pages are added.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.clanfitness.in",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://www.clanfitness.in/privacy",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
