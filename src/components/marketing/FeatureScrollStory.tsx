"use client";

import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import { PhoneMockup } from "./PhoneMockup";
import type { Chapter } from "./chapters";

/**
 * Motion's useScroll({ target }) measured this section's position incorrectly in this app (values
 * were wrong from the very first paint, e.g. reporting ~45% progress at scrollY 0), independent of
 * scroll position — computing it directly from a plain scroll/resize listener instead sidesteps
 * whatever measurement issue that was, and is trivial to reason about and verify.
 */
function useSectionScrollProgress(ref: RefObject<HTMLElement | null>) {
  const progress = useMotionValue(0);

  useEffect(() => {
    function update() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        progress.set(rect.top <= 0 ? 1 : 0);
        return;
      }
      progress.set(Math.min(1, Math.max(0, -rect.top / scrollable)));
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref, progress]);

  return progress;
}

/**
 * With `n` chapters stacked as h-screen blocks and a sticky visual pinned beside them, the total
 * *scrollable* distance through this section is (n-1) viewport-heights, not n — the last chapter
 * only needs to scroll into place, not scroll past itself too. So chapter `i` is fully centered
 * in the viewport at progress = i/(n-1), not at i/n as a naive equal-thirds split would assume —
 * using equal-thirds here previously caused the sticky visual to crossfade a full chapter ahead of
 * (or behind) whichever chapter's text was actually on screen.
 */
function useChapterOpacity(progress: MotionValue<number>, index: number, total: number) {
  const center = index / (total - 1);
  const prevCenter = index === 0 ? null : (index - 1) / (total - 1);
  const nextCenter = index === total - 1 ? null : (index + 1) / (total - 1);
  const t = 0.05;
  const fadeInAt = prevCenter === null ? 0 : (prevCenter + center) / 2;
  const fadeOutAt = nextCenter === null ? 1 : (center + nextCenter) / 2;

  const input =
    prevCenter === null
      ? [0, fadeOutAt - t, fadeOutAt + t]
      : nextCenter === null
        ? [fadeInAt - t, fadeInAt + t, 1]
        : [fadeInAt - t, fadeInAt + t, fadeOutAt - t, fadeOutAt + t];
  const output = prevCenter === null ? [1, 1, 0] : nextCenter === null ? [0, 1, 1] : [0, 1, 1, 0];

  return useTransform(progress, input, output);
}

function ChapterLayer({
  index,
  total,
  progress,
  chapter,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  chapter: Chapter;
}) {
  const opacity = useChapterOpacity(progress, index, total);
  return (
    <motion.div style={{ opacity }} className="absolute inset-0 flex items-center justify-center">
      {chapter.visual}
    </motion.div>
  );
}

/** Dims (not hides — stays readable) whichever chapter's text isn't the currently-active one, using
 * the exact same active-ness signal as the visual crossfade, so text and phone always agree. */
function TextChapter({
  index,
  total,
  progress,
  chapter,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  chapter: Chapter;
}) {
  const activeness = useChapterOpacity(progress, index, total);
  const opacity = useTransform(activeness, (v) => 0.35 + v * 0.65);
  return (
    <motion.div style={{ opacity }} className="flex h-screen flex-col justify-center gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{chapter.eyebrow}</p>
      <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
        {chapter.title}
      </h2>
      <p className="max-w-sm text-base text-foreground-secondary">{chapter.description}</p>
    </motion.div>
  );
}

/**
 * One phone stays pinned (sticky) while chapter text scrolls past beside it; its screen content
 * crossfades between chapters in sync with scroll progress through this section — reads as one
 * continuous app rather than three separate screenshots. Desktop-only (see Features.tsx) — needs
 * real side-by-side width to not feel like scroll-jacking on a narrow screen.
 */
export function FeatureScrollStory({ chapters }: { chapters: Chapter[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useSectionScrollProgress(ref);

  return (
    <section ref={ref} className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-16 px-6">
      <div className="flex flex-col">
        {chapters.map((chapter, i) => (
          <TextChapter key={chapter.title} index={i} total={chapters.length} progress={progress} chapter={chapter} />
        ))}
      </div>
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <PhoneMockup>
          <div className="relative h-full w-full">
            {chapters.map((chapter, i) => (
              <ChapterLayer key={chapter.title} index={i} total={chapters.length} progress={progress} chapter={chapter} />
            ))}
          </div>
        </PhoneMockup>
      </div>
    </section>
  );
}
