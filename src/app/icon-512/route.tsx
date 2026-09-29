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
          fontSize: 308,
          fontWeight: 700,
          borderRadius: 118,
        }}
      >
        K
      </div>
    ),
    { width: 512, height: 512 },
  );
}
