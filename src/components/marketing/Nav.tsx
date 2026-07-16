"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 transition-colors duration-300 ${
        scrolled ? "border-b border-surface-border bg-background/70 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, no benefit from next/image's raster pipeline */}
      <img src="/logo/clan-fitness-logo.svg" alt="Clan Fitness" className="h-9 w-auto" />
      <div className="flex items-center gap-4">
        <Link href="/sign-in" className="text-sm font-semibold text-foreground-secondary">
          Sign in
        </Link>
        <Link href="/sign-up">
          <Button className="px-4 py-2 text-xs">Get started</Button>
        </Link>
      </div>
    </header>
  );
}
