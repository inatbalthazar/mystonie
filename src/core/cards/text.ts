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

/** Title size step so long titles fit: 0 = largest. Counts characters, not glyph widths. */
export function titleSizeStep(name: string): 0 | 1 | 2 | 3 {
  const n = [...name].length;
  return n <= 14 ? 0 : n <= 28 ? 1 : n <= 48 ? 2 : 3;
}

/**
 * Whether text renders with the Latin font bundled for OG images (Basic Latin, Latin-1, Latin Extended,
 * general punctuation). Link previews leave other scripts out rather than show empty boxes.
 */
export function isLatinSafe(text: string): boolean {
  return /^[\u0020-\u007e\u00a0-\u024f\u2010-\u2027\u2030-\u205e]*$/.test(text);
}
