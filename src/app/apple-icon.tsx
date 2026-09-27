import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Home-screen icon, generated at build time from the Stonie mark in icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const mark = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");

  return new ImageResponse(
    (
      // iOS fills transparent pixels with black, so the background is opaque.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf9f5",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM */}
        <img src={`data:image/svg+xml;base64,${mark}`} width={136} height={136} alt="" />
      </div>
    ),
    size,
  );
}
