import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import en from "../../messages/en.json";

// Default link preview for every page, generated at build time. English only so the
// bundled Latin font covers it (Thai pages share this image).
export const alt = en.Metadata.description;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
          padding: 80,
          background: "#141414",
          color: "#fafafa",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM */}
        <img src={`data:image/svg+xml;base64,${mark}`} width={260} height={260} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 680 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{en.Metadata.title}</div>
          <div style={{ fontSize: 40, color: "#b5b5b5" }}>{en.Metadata.description}</div>
        </div>
      </div>
    ),
    size,
  );
}
