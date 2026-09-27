import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { ImageResponse } from "next/og";
import { isLatinSafe, watchMinutes } from "@/core/cards/text";
import { formatRuntime } from "@/core/format/runtime";
import { recapFigures } from "@/core/stats/recap";
import en from "../../../../../messages/en.json";
import { loadCard } from "./load";

// Link preview of a shared card (X, Facebook, iMessage…). English only and Latin-safe, like the site's
// default image: the bundled font has no Thai/CJK glyphs, so a non-Latin title is left to og:title (text),
// which every platform renders itself.
export const alt = "A card made with Mystonie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#161310";
const PAPER = "#f5f1ec";
const CORAL = "#f47249";
const MUTED = "#ada7a0";

/** The poster as a data URL, or null (a slow or missing poster must not break the preview). */
async function posterData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url.replace(/\/w\d+\//, "/w500/"), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const [card, mark] = await Promise.all([loadCard(id), readFile(join(process.cwd(), "src/app/icon.svg"), "base64")]);
  const t = createTranslator({ locale: "en", messages: en, namespace: "Card" });
  const data = card?.data;
  const poster = await posterData(data?.posterUrl);
  const hidden = new Set(data?.hide ?? []);

  const recap = data?.recap;
  const headline = !data
    ? en.Metadata.title
    : recap
      ? t("recapHeadline", { period: recap.period ?? "week" })
      : data.progress
        ? data.progress.milestone
          ? t("milestone", { milestone: data.progress.milestone })
          : t("episodeCode", { season: data.progress.season, episode: data.progress.episode })
        : t("finished");
  const day = (key: string) => new Date(`${key}T00:00:00Z`);
  const name = recap
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).formatRange(day(recap.from), day(recap.to))
    : data && isLatinSafe(data.name)
      ? data.name
      : null;
  const minutes = data ? (data.progress ? data.progress.watchedMin : watchMinutes(data)) : null;
  const facts = recap
    ? recapFigures(recap, { time: hidden.has("time"), episodes: hidden.has("episodes") }).map(({ key, value }) =>
        key === "finished"
          ? `${value} ${t("titlesFinished", { count: value })}`
          : key === "episodes"
            ? `${value} ${t("episodes", { count: value })}`
            : `${value} ${t(key)}`,
      )
    : data
    ? [
        t("kind", { kind: data.kind }),
        data.year ? String(data.year) : null,
        data.progress && !hidden.has("episodes") ? t("progressCount", { watched: data.progress.watched, total: data.progress.total }) : null,
        minutes && !hidden.has("time") ? formatRuntime(minutes, "en") : null,
        data.rating ? `${data.rating} / 5` : null,
      ].filter(Boolean)
    : [];
  const byline = data?.username && isLatinSafe(data.username) ? `${en.Card.brand} · @${data.username}` : en.Card.brand;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INK, color: PAPER, padding: 56, gap: 56 }}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM
          <img src={poster} width={345} height={518} alt="" style={{ borderRadius: 16, border: `10px solid ${PAPER}`, transform: "rotate(-3deg)" }} />
        ) : (
          <div style={{ width: 345, height: 518, borderRadius: 16, background: "#2a2521", display: "flex" }} />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              border: `6px solid ${CORAL}`,
              borderRadius: 14,
              padding: "8px 22px",
              color: CORAL,
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              transform: "rotate(-4deg)",
            }}
          >
            {headline}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {name && (
              <div style={{ fontSize: name.length > 40 ? 52 : 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>
                {name.length > 80 ? `${name.slice(0, 78)}…` : name}
              </div>
            )}
            <div style={{ fontSize: 32, color: MUTED, display: "flex" }}>{facts.join(" · ")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the DOM */}
            <img src={`data:image/svg+xml;base64,${mark}`} width={56} height={56} alt="" />
            <div style={{ fontWeight: 700, display: "flex" }}>{byline}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
