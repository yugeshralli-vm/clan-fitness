"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { PhoneMockup } from "./PhoneMockup";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="flex min-h-[92vh] flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <h1 className="max-w-3xl text-[clamp(2.5rem,8vw,6rem)] font-black leading-[0.95] tracking-tight text-foreground">
        Skip a day.
        <br />
        <span className="text-accent">They&apos;ll notice.</span>
      </h1>
      <p className="max-w-md text-base text-foreground-secondary sm:text-lg">
        Track gym days, steps, and food with a small group of people who actually pay attention.
      </p>
      <Link href="/sign-up">
        <Button>Get started</Button>
      </Link>

      <motion.div style={{ y, opacity }} className="mt-6">
        <PhoneMockup>
          <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface p-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground-secondary"
              aria-hidden
            >
              M
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Maya</span>
                <span className="text-xs text-foreground-muted">7:42 AM</span>
              </div>
              <p className="text-sm text-foreground-secondary">👟 Logged 11,204 steps</p>
              <span className="w-fit rounded-full border border-surface-border px-2 py-0.5 text-xs text-foreground-tertiary">
                🔥 3
              </span>
            </div>
          </div>
        </PhoneMockup>
      </motion.div>
    </section>
  );
}
