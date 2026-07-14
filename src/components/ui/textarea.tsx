"use client";

import { TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";

// Grows with content instead of scrolling internally — a fixed-height box hides the end of a long
// note until the user scrolls inside it, which is easy to miss on a form you're about to submit.
function resize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function Textarea({
  className = "",
  onInput,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Sizes to any pre-filled defaultValue (e.g. editing an existing note) before first paint.
  useLayoutEffect(() => {
    if (ref.current) resize(ref.current);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      onInput={(e) => {
        resize(e.currentTarget);
        onInput?.(e);
      }}
      className={`w-full resize-none overflow-hidden rounded-lg border border-surface-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm ${className}`}
      {...props}
    />
  );
}
