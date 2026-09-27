import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import en from "../../messages/en.json";

// Default link preview for every page, generated at build time. English only so the
// bundled Latin font covers it (Thai pages share this image). Brand colours from globals.css.
export const alt = en.Metadata.description;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#161310";
const PAPER = "#f5f1ec";
const CORAL = "#f47249";

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");
  // "Finished it? <mark>Mystonie it.</mark>" → two lines, the second in coral.
  const [lead, marked] = en.Home.headline.replace("</mark>", "").split("<mark>") as [string, string];

  return (
    new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: INK, color: PAPER }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM */}
            <img src={`data:image/svg+xml;base64,${mark}`} width={88} height={88} alt="" />
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>{en.Card.brand}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 108, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>
            <div>{lead.trim()}</div>
            <div style={{ color: CORAL }}>{marked}</div>
          </div>
          <div style={{ fontSize: 36, color: "#ada7a0" }}>{en.Metadata.description}</div>
        </div>
      ),
      size,
    )
  );
}
