import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FitNMove - Train, Move, Compete";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          backgroundColor: "#000",
          borderRadius: 48,
          position: "relative",
        }}
      >
        {/* Ensō circle */}
        <svg
          width="180"
          height="180"
          viewBox="0 0 32 32"
          style={{ marginBottom: 32 }}
        >
          <circle
            cx="16"
            cy="16"
            r="10"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeDasharray="62.83"
            strokeDashoffset="8"
            strokeLinecap="round"
            transform="rotate(-40 16 16)"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          FitNMove
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 300,
            letterSpacing: "0.02em",
            marginBottom: 24,
          }}
        >
          Your Open-Source Health AI Agent
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 300,
            letterSpacing: "0.1em",
          }}
        >
          Train. Move. Compete.
        </div>
      </div>
    ),
    { ...size }
  );
}
