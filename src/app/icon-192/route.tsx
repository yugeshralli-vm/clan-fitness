import { ImageResponse } from "next/og";

export const dynamic = "force-static";

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
        <div style={{ display: "flex", fontSize: 110, fontWeight: 900, color: "#3bffad" }}>C</div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
