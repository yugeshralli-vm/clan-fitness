import type { ReactNode } from "react";
import { FeedVignette } from "./FeedVignette";
import { LeaderboardVignette } from "./LeaderboardVignette";
import { NotificationVignette } from "./NotificationVignette";

export type Chapter = { eyebrow: string; title: string; description: string; visual: ReactNode };

/** Single source of copy/visuals for the 3 feature chapters — consumed by both the desktop
 * sticky-scroll story and the mobile/reduced-motion fallback stack, so they never drift apart. */
export const CHAPTERS: Chapter[] = [
  {
    eyebrow: "Logging",
    title: "One check-in. Three things that matter.",
    description: "Gym, steps, and food — logged in under a minute, visible to your clan the second you save it.",
    visual: <FeedVignette />,
  },
  {
    eyebrow: "Streaks",
    title: "Watch your streak. Watch theirs too.",
    description:
      "A weekly leaderboard weighted toward steps and consistency — showing up matters more than any single big day.",
    visual: <LeaderboardVignette />,
  },
  {
    eyebrow: "Accountability",
    title: "Miss a day, and someone will ask.",
    description: "Reactions, comments, and nudges keep your clan in the loop — not a silent app nobody opens.",
    visual: <NotificationVignette />,
  },
];
