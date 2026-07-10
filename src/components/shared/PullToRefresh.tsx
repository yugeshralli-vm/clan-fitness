"use client";

import { useRef } from "react";

/**
 * Just the scroll container for now. The touch-driven pull-to-refresh gesture this component used
 * to implement (tracking touchmove and calling event.preventDefault() while pulling down from the
 * top) was disabled after it was found to occasionally block ordinary scrolling on Android —
 * likely Android's momentum-scroll physics reporting a stale scrollTop when a fast fling is
 * stopped with a tap, which this component misread as "starting a pull" and intercepted.
 *
 * Owning this scroll container still matters on its own, independent of the gesture: it's what
 * lets the outer app shell stay a fixed-height, non-scrolling flex column (see AppLayout), keeping
 * the header/BottomNav as plain flex children instead of position: fixed — the document itself
 * never scrolls, so the mobile browser's address-bar show/hide animation never triggers.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-y-contain">
      {children}
    </div>
  );
}
