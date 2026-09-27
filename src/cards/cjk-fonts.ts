import { Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";

// Korean/Japanese card fallbacks. Each family is ~250 @font-face rules (~340 KB of CSS), so this
// module is imported only when a card contains Hangul or kana/kanji (see fonts.ts), never on the first screen.
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", weight: ["400", "700"], preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", weight: ["400", "700"], preload: false });

/** Defines `--font-noto-kr` / `--font-noto-jp` on the page, which the card font stacks read. */
export function applyCjkFonts() {
  document.documentElement.classList.add(notoKr.variable, notoJp.variable);
}
