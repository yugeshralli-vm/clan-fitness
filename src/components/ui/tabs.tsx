"use client";

import { useState, type ReactNode } from "react";
import { triggerHaptic } from "@/lib/haptics";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({ tabs, defaultTabId }: { tabs: TabItem[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex gap-1 rounded-full border border-surface-border bg-surface p-1">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                triggerHaptic();
                setActiveId(tab.id);
              }}
              className={`min-h-9 min-w-0 flex-1 rounded-full px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-tertiary hover:text-foreground-secondary"
              }`}
            >
              <span className="block truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* All panels stack in the same grid cell rather than being toggled with `hidden` — a
          hidden panel is display:none and contributes no height, so the container would resize
          to whichever tab happens to be active. Stacking keeps every panel in the layout (grid
          sizes to the tallest), so the height stays constant across tabs; `inert` on the inactive
          ones keeps them out of focus/interaction/the a11y tree without removing their height. */}
      <div className="relative grid">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`panel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              inert={!active}
              className={`col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-150 ${
                active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
