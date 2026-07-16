import Link from "next/link";

export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-surface-border px-6 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, no benefit from next/image's raster pipeline */}
      <img src="/logo/clan-fitness-logo.svg" alt="Clan Fitness" className="h-5 w-auto opacity-70" />
      <p className="text-xs text-foreground-muted">© {new Date().getFullYear()} Clan Fitness</p>
      <Link href="/sign-in" className="text-xs font-semibold text-foreground-tertiary">
        Sign in
      </Link>
    </footer>
  );
}
