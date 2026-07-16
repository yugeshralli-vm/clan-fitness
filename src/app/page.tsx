import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EmotionalStatement } from "@/components/marketing/EmotionalStatement";
import { Features } from "@/components/marketing/Features";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { Nav } from "@/components/marketing/Nav";
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
      <Nav />
      <Hero />
      <Features />
      <EmotionalStatement />
      <FinalCta />
      <Footer />
    </main>
  );
}
