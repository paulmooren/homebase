import { ImageResponse } from "next/og";

// Maskable icons get cropped into arbitrary shapes (circle, squircle, etc.)
// by the OS, so the background must fill edge-to-edge with no rounding of
// its own, and the glyph must stay well inside the ~80% "safe zone".
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
          background: "#18181b",
          color: "#ffffff",
          fontSize: 200,
          fontWeight: 700,
        }}
      >
        K
      </div>
    ),
    { width: 512, height: 512 },
  );
}
