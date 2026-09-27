import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// App icons for the web app manifest (src/app/manifest.ts) and notifications (public/sw.js), rendered once at
// build time from the Stonie mark in icon.svg (ADR 0017, ADR 0028).
const PAPER = "#fbf9f5";

// The stone's outline from icon.svg, for the one-colour notification badge (Android keeps only the alpha).
const STONE = "M31 7c10-1 20 3 25 11 5 8 5 20-1 28-6 8-15 11-24 11-10 0-18-4-23-12-4-7-4-17 1-25C14 12 22 8 31 7z";

const FILES = {
  // "any": the mark fills most of the square, on paper (iOS and some launchers show transparency as black).
  "icon-192.png": { size: 192, mark: 0.78, background: PAPER },
  "icon-512.png": { size: 512, mark: 0.78, background: PAPER },
  // "maskable": launchers crop to a circle or squircle, so the mark stays inside the 80% safe zone.
  "maskable-512.png": { size: 512, mark: 0.56, background: PAPER },
  "badge-96.png": { size: 96, mark: 0.86, background: null },
} as const;

type File = keyof typeof FILES;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa/[file]">) {
  const file = (await params).file as File;
  const { size, mark, background } = FILES[file];
  const px = Math.round(size * mark);
  const src =
    background === null
      ? `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${STONE}" fill="#fff"/></svg>`).toString("base64")}`
      : `data:image/svg+xml;base64,${await readFile(join(process.cwd(), "src/app/icon.svg"), "base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: background ?? "transparent" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM */}
        <img src={src} width={px} height={px} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
