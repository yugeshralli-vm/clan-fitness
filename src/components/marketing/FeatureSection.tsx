import type { ReactNode } from "react";
import { RevealOnScroll } from "./RevealOnScroll";

export function FeatureSection({
  eyebrow,
  title,
  description,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 py-24 sm:py-32 md:flex-row md:gap-16">
      <RevealOnScroll className={`flex flex-1 flex-col gap-4 text-center md:text-left ${reverse ? "md:order-2" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</p>
        <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">{title}</h2>
        <p className="text-base text-foreground-secondary">{description}</p>
      </RevealOnScroll>
      <RevealOnScroll delay={0.15} className={`flex flex-1 justify-center ${reverse ? "md:order-1" : ""}`}>
        {visual}
      </RevealOnScroll>
    </section>
  );
}
