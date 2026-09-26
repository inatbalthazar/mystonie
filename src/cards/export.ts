"use client";

import { domToBlob } from "modern-screenshot";
import { useEffect, useState, type RefObject } from "react";
import { CARD_DIMENSIONS, type CardSize } from "@/core/cards/types";

/** Renders the (unscaled) card node to a PNG at export size, after fonts and images are ready. */
export async function renderCardPng(node: HTMLElement, size: CardSize): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all(
    [...node.querySelectorAll("img")].map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))),
  );
  const { width, height } = CARD_DIMENSIONS[size];
  const card = node.querySelector<HTMLElement>("[data-card]") ?? node;
  const blob = await domToBlob(card, { width, height, scale: 1, type: "image/png" });
  if (!blob) throw new Error("Card render returned no image");
  return blob;
}

/**
 * Keeps a PNG of the card ready: re-renders after the preview settles (`key` changes).
 * Share must use this ready Blob synchronously, since iOS rejects a share that awaits a render.
 */
export function usePrerenderedCard(ref: RefObject<HTMLElement | null>, size: CardSize, key: string, delayMs = 400) {
  const [png, setPng] = useState<{ key: string; blob: Blob } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const node = ref.current;
      if (!node) return;
      try {
        const blob = await renderCardPng(node, size);
        if (!cancelled) setPng({ key, blob });
      } catch (error) {
        console.error(error);
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref, size, key, delayMs]);

  return png?.key === key ? png.blob : null;
}

/** Saves a Blob as a file (desktop Download). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
