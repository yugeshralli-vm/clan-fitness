import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const satoshi = localFont({
  variable: "--font-satoshi",
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
});

const DESCRIPTION =
  "Track gym days, steps, and food with a small group of people who'll actually notice if you skip.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clanfitness.in"),
  title: "Clan Fitness",
  description: DESCRIPTION,
  openGraph: {
    title: "Clan Fitness",
    description: DESCRIPTION,
    url: "https://www.clanfitness.in",
    siteName: "Clan Fitness",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clan Fitness",
    description: DESCRIPTION,
  },
  appleWebApp: {
    title: "Clan Fitness",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorPrimary: "#3bffad",
          colorBackground: "#121212",
          colorDanger: "#ee4d37",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html
        lang="en"
        className={`${satoshi.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col font-sans">
          {children}
          <ServiceWorkerRegistration />
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
