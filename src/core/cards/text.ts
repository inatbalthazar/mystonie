import type { TitleKind } from "../catalog/types";
import type { CardData } from "./types";

export type Script = "thai" | "korean" | "japanese";

const PATTERNS: Record<Script, RegExp> = {
  thai: /[฀-๿]/,
  korean: /[ᄀ-ᇿ㄰-㆏가-힯]/,
  // Kana, plus CJK ideographs (kanji; also covers Chinese, which Noto Sans JP renders acceptably).
  japanese: /[぀-ヿㇰ-ㇿ一-鿿㐀-䶿]/,
};

/** Non-Latin scripts present in the card text, i.e. which Noto fallbacks the card needs. */
export function scriptsIn(...texts: (string | null | undefined)[]): Script[] {
  const all = texts.filter(Boolean).join(" ");
  return (Object.keys(PATTERNS) as Script[]).filter((s) => PATTERNS[s].test(all));
}

/** Total watch time for the card's stat line: runtime × episodes for a series. */
export function watchMinutes(card: Pick<CardData, "kind" | "runtimeMin" | "episodeCount">): number | null {
  if (!card.runtimeMin) return null;
  if (card.kind !== "series") return card.runtimeMin;
  return card.episodeCount ? card.runtimeMin * card.episodeCount : null;
}

/** The Finish card's word for a kind (`Card` messages): "Finished" in English; Thai says watched, read or played. */
export function finishedKey(kind: TitleKind): "finished" | "finishedRead" | "finishedPlay" {
  return kind === "book" || kind === "manga" ? "finishedRead" : kind === "game" ? "finishedPlay" : "finished";
}

/**
 * A game's hours for a card (S3 games): the player's own, else RAWG's average playtime; null for other kinds or when
 * neither is known. `own` says which it is.
 */
export function gameHours(card: Pick<CardData, "kind" | "hoursPlayed" | "playtimeHours">): { hours: number; own: boolean } | null {
  if (card.kind !== "game") return null;
  if (card.hoursPlayed) return { hours: card.hoursPlayed, own: true };
  return card.playtimeHours ? { hours: card.playtimeHours, own: false } : null;
}

/** East Asian wide characters: CJK ideographs, kana, Hangul and full-width forms take about two letters' room. */
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

/** Title size step so long titles fit: 0 = largest. Counts characters (a wide one as two), not glyph widths. */
export function titleSizeStep(name: string): 0 | 1 | 2 | 3 {
  const n = [...name].reduce((sum, ch) => sum + (WIDE.test(ch) ? 2 : 1), 0);
  return n <= 14 ? 0 : n <= 28 ? 1 : n <= 48 ? 2 : 3;
}

/**
 * Whether text renders with the Latin font bundled for OG images (Basic Latin, Latin-1, Latin Extended,
 * general punctuation). Link previews leave other scripts out rather than show empty boxes.
 */
export function isLatinSafe(text: string): boolean {
  return /^[\u0020-\u007e\u00a0-\u024f\u2010-\u2027\u2030-\u205e]*$/.test(text);
}
