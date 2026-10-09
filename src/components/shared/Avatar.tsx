import Image from "next/image";

export function Avatar({
  src,
  name,
  size = 32,
  online,
}: {
  src?: string | null;
  name: string;
  size?: number;
  /** Shows a green presence dot — pass it via OnlineAvatar, which reads live presence. */
  online?: boolean;
}) {
  const avatar = src ? (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground-secondary"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );

  if (!online) return avatar;

  // Scales with the avatar but never smaller than 8px, so it stays visible on 24-28px avatars.
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <span
        className="absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-surface"
        style={{ width: dot, height: dot }}
        role="img"
        aria-label="Online"
      />
    </span>
  );
}
