import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  // www.clanfitness.in is canonical — avoids duplicate-content/split ranking signals between the
  // apex and www hosts. No-op if the apex domain isn't actually attached in the Vercel project.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clanfitness.in" }],
        destination: "https://www.clanfitness.in/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
