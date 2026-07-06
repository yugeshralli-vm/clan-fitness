import { ImageResponse } from "next/og";

export const dynamic = "force-static";

// Android's maskable-icon spec crops to a safe zone (~80% diameter circle centered
// on the canvas), so the glyph is kept smaller and more central than the plain icons.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
        }}
      >
        <div style={{ display: "flex", fontSize: 180, fontWeight: 900, color: "#3bffad" }}>C</div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
