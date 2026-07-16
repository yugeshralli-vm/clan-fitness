import type { ReactNode } from "react";

/**
 * Pure-CSS iPhone-style device frame — no image asset needed, so vignette content stays real
 * markup, not a screenshot. Fixed (not min-) screen height: the sticky scroll-story crossfades
 * multiple children on top of each other inside this frame, and a height that could shift between
 * them would make the frame visibly resize mid-crossfade.
 */
export function PhoneMockup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-[260px] shrink-0 ${className}`}>
      <div className="absolute -left-[2px] top-[100px] h-7 w-[3px] rounded-l-sm bg-[#3a3a3a]" aria-hidden />
      <div className="absolute -left-[2px] top-[145px] h-10 w-[3px] rounded-l-sm bg-[#3a3a3a]" aria-hidden />
      <div className="absolute -left-[2px] top-[190px] h-10 w-[3px] rounded-l-sm bg-[#3a3a3a]" aria-hidden />
      <div className="absolute -right-[2px] top-[135px] h-14 w-[3px] rounded-r-sm bg-[#3a3a3a]" aria-hidden />

      <div className="relative rounded-[2.8rem] border-[3px] border-[#2c2c2c] bg-[#050505] p-[9px] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div
          className="pointer-events-none absolute inset-[3px] z-20 rounded-[2.6rem]"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 30%)" }}
          aria-hidden
        />
        <div className="relative flex h-[460px] flex-col justify-center gap-3 overflow-hidden rounded-[2.6rem] bg-background px-4 pt-8 pb-6">
          <div className="absolute top-2.5 left-1/2 z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
          {children}
        </div>
      </div>
    </div>
  );
}
