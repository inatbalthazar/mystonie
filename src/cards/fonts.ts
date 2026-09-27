"use client";

import { scriptsIn } from "@/core/cards/text";

let cjk: Promise<void> | null = null;

/** Loads the Korean/Japanese Noto fallbacks once, if the text needs them. Resolves when their CSS is in. */
export function ensureCardFonts(...texts: (string | null | undefined)[]): Promise<void> {
  const scripts = scriptsIn(...texts);
  if (!scripts.includes("korean") && !scripts.includes("japanese")) return Promise.resolve();
  cjk ??= import("./cjk-fonts").then((m) => m.applyCjkFonts());
  return cjk;
}
