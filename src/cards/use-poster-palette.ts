"use client";

import { useEffect, useState } from "react";
import { cardImageUrl } from "@/core/catalog/images";
import { DEFAULT_PALETTE, paletteFromPixels } from "@/core/cards/palette";
import type { Palette } from "@/core/cards/types";

const cache = new Map<string, Palette>();

/**
 * Card palette from a poster URL, read from the image the card draws (`cardImageUrl`): TMDB and AniList send CORS
 * headers to it, so the canvas stays readable, and it's one download for both. Falls back to the default palette
 * without a poster or on any error.
 */
export function usePosterPalette(url: string | null | undefined): Palette {
  const [loaded, setLoaded] = useState<{ url: string; palette: Palette } | null>(null);

  useEffect(() => {
    if (!url || cache.has(url)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 36;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const palette = paletteFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        cache.set(url, palette);
        if (!cancelled) setLoaded({ url, palette });
      } catch {
        // Tainted canvas or decode error: keep the default palette.
      }
    };
    img.src = cardImageUrl(url);
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return DEFAULT_PALETTE;
  return cache.get(url) ?? (loaded?.url === url ? loaded.palette : DEFAULT_PALETTE);
}
