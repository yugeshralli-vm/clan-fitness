"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export function PhotoCarousel({
  photos,
  onPhotoClick,
}: {
  photos: string[];
  onPhotoClick?: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafPending = useRef(false);

  function handleScroll() {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const el = trackRef.current;
      if (!el) return;
      setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  }

  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onPhotoClick?.(0)}
        aria-label="View photo full-screen"
        className="block w-full max-w-xs cursor-zoom-in"
      >
        <Image
          src={photos[0]}
          alt=""
          width={320}
          height={240}
          className="max-h-60 w-full max-w-xs rounded-lg border border-surface-border object-cover"
        />
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-lg border border-surface-border scroll-smooth"
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onPhotoClick?.(i)}
              aria-label={`View photo ${i + 1} of ${photos.length} full-screen`}
              className="w-full shrink-0 snap-center cursor-zoom-in"
            >
              <Image src={url} alt="" width={320} height={240} className="max-h-60 w-full object-cover" />
            </button>
          ))}
        </div>
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          {activeIndex + 1}/{photos.length}
        </span>
      </div>
      <div className="flex justify-center gap-1">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === activeIndex ? "w-4 bg-accent" : "w-1.5 bg-foreground-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
