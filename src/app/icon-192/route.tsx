import { ImageResponse } from "next/og";

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
          fontSize: 116,
          fontWeight: 700,
          borderRadius: 44,
        }}
      >
        H
      </div>
    ),
    { width: 192, height: 192 },
  );
}
