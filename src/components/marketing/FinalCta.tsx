import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RevealOnScroll } from "./RevealOnScroll";

export function FinalCta() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-32 text-center">
      <RevealOnScroll className="flex flex-col items-center gap-8">
        <h2 className="text-[clamp(2rem,6vw,4rem)] font-black leading-none tracking-tight text-foreground">
          Find your clan.
        </h2>
        <Link href="/sign-up">
          <Button>Get started</Button>
        </Link>
      </RevealOnScroll>
    </section>
  );
}
