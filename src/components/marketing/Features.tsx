"use client";

import { useReducedMotion } from "motion/react";
import { CHAPTERS } from "./chapters";
import { FeatureScrollStory } from "./FeatureScrollStory";
import { FeatureSection } from "./FeatureSection";
import { PhoneMockup } from "./PhoneMockup";

/**
 * The sticky-scroll "one phone, changing content" story (FeatureScrollStory) needs real
 * side-by-side width to read as intentional rather than janky — desktop only. Mobile, and
 * reduced-motion at any width, fall back to the simpler independently-revealing stack.
 */
export function Features() {
  const reduceMotion = useReducedMotion();

  const fallbackStack = (
    <div className="flex flex-col">
      {CHAPTERS.map((chapter, i) => (
        <FeatureSection
          key={chapter.title}
          eyebrow={chapter.eyebrow}
          title={chapter.title}
          description={chapter.description}
          visual={<PhoneMockup>{chapter.visual}</PhoneMockup>}
          reverse={i % 2 === 1}
        />
      ))}
    </div>
  );

  if (reduceMotion) return fallbackStack;

  return (
    <>
      <div className="md:hidden">{fallbackStack}</div>
      <div className="hidden md:block">
        <FeatureScrollStory chapters={CHAPTERS} />
      </div>
    </>
  );
}
