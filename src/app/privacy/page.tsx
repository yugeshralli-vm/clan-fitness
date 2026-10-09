import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy · Clan Fitness",
  description: "What Clan Fitness collects, how it's used, who can see it, and how to delete it.",
  alternates: { canonical: "https://www.clanfitness.in/privacy" },
};

const CONTACT_EMAIL = "yugeshr16@gmail.com";
const EFFECTIVE_DATE = "October 10, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground-secondary">{children}</div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent">
    {CONTACT_EMAIL}
  </a>
);

// Public (see src/proxy.ts's isPublicRoute) — linked from the site footer and from Android's
// Health Connect permission screen, which Google Play requires to point at this policy.
export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center px-6 py-4">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, no benefit from next/image's raster pipeline */}
          <img src="/logo/clan-fitness-logo.svg" alt="Clan Fitness" className="h-9 w-auto" />
        </Link>
      </header>

      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-foreground-tertiary">Effective {EFFECTIVE_DATE}</p>
          <p className="text-sm leading-relaxed text-foreground-secondary">
            Clan Fitness is a fitness accountability app run by Yugesh Ralli, an individual based in India (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;). It&apos;s available at clanfitness.in, as an installable web app, and as an Android app. This
            policy explains what we collect, why, who can see it, and how to delete it. Questions: {mail}.
          </p>
        </div>

        <Section title="What we collect">
          <p>Only what you give us or what the app needs to work:</p>
          <List
            items={[
              <>
                <strong className="text-foreground">Account:</strong>{" "}your name, email address and profile photo, from
                signing up or signing in with Google.
              </>,
              <>
                <strong className="text-foreground">Profile and goals (optional):</strong>{" "}height, weight, date of birth,
                gender, your timezone, and your weekly gym and daily step targets.
              </>,
              <>
                <strong className="text-foreground">Check-ins:</strong>{" "}whether you worked out, your step count, how your
                eating went, any notes, food photos you add, and your daily &ldquo;thought&rdquo;.
              </>,
              <>
                <strong className="text-foreground">Clan activity:</strong>{" "}the clans you create or join, comments,
                reactions, clan chat messages, nudges, contract claims, points and levels.
              </>,
              <>
                <strong className="text-foreground">Notifications:</strong>{" "}if you allow push notifications, a push
                subscription for your browser or device; a record of the notifications sent to you; and your notification
                preferences.
              </>,
              <>
                <strong className="text-foreground">Usage and diagnostics:</strong>{" "}page-view and performance statistics
                via Vercel Web Analytics and Speed Insights, which don&apos;t use cookies or track you across other sites.
              </>,
            ]}
          />
          <p>
            While the app is open, we also know you&apos;re online so we can show a green dot and live updates to your
            clanmates. That status isn&apos;t stored; it disappears when you close the app.
          </p>
        </Section>

        <Section title="Steps from Health Connect (Android app)">
          <p>
            If you allow it, the Android app reads <strong className="text-foreground">today&apos;s step count</strong>{" "}
            from Health Connect, which Google Fit, Samsung Health, Fitbit and other apps write to. That is the only health
            data we read. We never write to Health Connect.
          </p>
          <List
            items={[
              "The step count is only used to fill in the Steps field on your Log screen, so you don't have to type it.",
              "Nothing is sent to us until you tap Save. Once saved, it's a normal check-in, the same as typing the number yourself.",
              "Health Connect data is never sold, never used for advertising, and never shared with anyone except as part of the check-in you choose to save.",
              "You can turn off access at any time in Health Connect's settings (Settings › Health Connect › App permissions › Clan Fitness).",
            ]}
          />
          <p>
            The use of information received from Health Connect adheres to the Health Connect Permissions policy, including
            its Limited Use requirements.
          </p>
        </Section>

        <Section title="How we use it">
          <List
            items={[
              "To run the app: your log, streaks, the clan feed and leaderboard, chat, contracts, points and levels.",
              "To send the notifications you've asked for (comments, mentions, reactions, check-ins, nudges, weekly recaps), by push and email.",
              "To keep the service working and secure, and to fix problems.",
            ]}
          />
          <p>
            We don&apos;t sell your data, we don&apos;t show ads, and we don&apos;t use your data to build advertising
            profiles.
          </p>
        </Section>

        <Section title="Who can see your data">
          <List
            items={[
              "Members of your clans see your name, photo, level, check-ins (including notes and food photos), comments, reactions, chat messages and whether you're online. Members can view each other's profiles.",
              "Food photos are stored at long, unguessable links. Anyone who has a photo's exact link can open it, so only share links you're comfortable sharing.",
              "Your email address, body measurements and date of birth aren't shown to other members.",
              "The operator can access data when needed to run, support and secure the service, for example to send announcements or investigate a problem.",
            ]}
          />
        </Section>

        <Section title="Service providers">
          <p>We use these companies to run Clan Fitness. They process data only to provide their service to us:</p>
          <List
            items={[
              "Clerk: sign-in and accounts.",
              "Google: sign-in with Google, if you choose it.",
              "Neon: database hosting.",
              "Vercel: website hosting, photo storage, and privacy-friendly analytics.",
              "Railway: the live-updates connection (online status, typing, new activity).",
              "Resend: notification emails.",
              "Your browser's or phone's push service (for example Google or Apple) delivers push notifications.",
            ]}
          />
          <p>Some of these providers store data outside India.</p>
        </Section>

        <Section title="How long we keep it, and deleting it">
          <p id="delete-account">
            We keep your data for as long as your account exists. You can delete your account at any time: in the
            Android app (Profile › Delete account) or on the website (sign in at clanfitness.in, then Profile › Edit
            profile › Settings › Delete account). If you can&apos;t sign in, email {mail} from the address you signed up
            with and we&apos;ll delete it within 30 days.
          </p>
          <p>
            Deleting your account permanently removes your profile, goals, check-ins, photos, comments, reactions, chat
            messages, contract claims, points, notifications and push subscriptions, and your sign-in account. Clans you
            run are handed to their longest-standing member; a clan with no one else in it is deleted. Other members&apos;
            own posts stay, including replies to your messages (shown without your original).
          </p>
        </Section>

        <Section title="Your choices and rights">
          <List
            items={[
              "Edit your profile and goals at any time, and today's check-in during the day.",
              "Turn push and email notifications on or off per type in your profile settings.",
              "Turn off Health Connect access in Health Connect's settings.",
              <>
                Ask us for a copy of your data, to correct it, or to delete it, by emailing {mail}. You can also raise a
                grievance with us at the same address, including under India&apos;s Digital Personal Data Protection Act,
                2023.
              </>,
            ]}
          />
        </Section>

        <Section title="Security">
          <p>
            Data is sent over encrypted connections (HTTPS). Sign-in is handled by Clerk, so we never see or store your
            password. No system is perfectly secure, but we take reasonable steps to protect your data.
          </p>
        </Section>

        <Section title="Children">
          <p>Clan Fitness is intended for people 18 and older. We don&apos;t knowingly collect data from children.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy, we&apos;ll update the date at the top. For significant changes, we&apos;ll also let
            you know in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>Yugesh Ralli, operator of Clan Fitness: {mail}</p>
        </Section>
      </article>

      <Footer />
    </main>
  );
}
