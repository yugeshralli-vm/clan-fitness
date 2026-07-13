import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Clan Fitness";
export const dynamic = "force-static";

// Satori (the ImageResponse renderer) only supports ttf/otf, not the woff2 files this app's
// Satoshi font ships as — falls back to its default sans rather than adding a font-conversion step.
export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public/logo/app-icon-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          backgroundColor: "#0d0d0d",
        }}
      >
        <img src={logoSrc} width={140} height={140} style={{ borderRadius: 28 }} alt="" />
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#f5f5f5" }}>
          Clan Fitness
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: 760,
            textAlign: "center",
            fontSize: 32,
            fontWeight: 500,
            color: "#a3a3a3",
          }}
        >
          Track gym days, steps, and food with a small group of people who&apos;ll actually notice
          if you skip.
        </div>
      </div>
    ),
    size,
  );
}
