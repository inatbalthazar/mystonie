"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { loadWorldMap, WorldMap, type MapTone } from "@/components/atlas/world-map";
import { Reveal } from "@/components/motion/reveal";

/** A sample collection's Atlas: stories from every continent but Antarctica, the darker the more of them. */
const STORIES = new Map<string, MapTone>([
  ["US", 4], ["GB", 3], ["FR", 2], ["ES", 1], ["DE", 2], ["KR", 4], ["JP", 3], ["IN", 2],
  ["BR", 2], ["MX", 1], ["NG", 1], ["AU", 1], ["CA", 2], ["IT", 1],
]);
const CONTINENTS = 6;

/**
 * The landing page's Atlas: the real world map with a sample collection's countries in the Stories colours. The map's
 * outlines (about 80 KB) load only once it's near the screen, so the first screen doesn't wait on them.
 */
export function AtlasArt() {
  const t = useTranslations("Home");
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Awaited<ReturnType<typeof loadWorldMap>> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        loadWorldMap().then(
          (data) => live && setMap(data),
          (error: unknown) => console.error(error),
        );
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, []);

  return (
    <Reveal className="rise relative mx-auto max-w-sm rotate-[1deg] rounded-2xl bg-card p-2.5 pt-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_32px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
      <span className="absolute -top-3 left-6 z-10 h-6 w-16 -rotate-6 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
      <span className="absolute -top-3 right-6 z-10 h-6 w-16 rotate-6 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
      <div ref={ref} className="overflow-hidden rounded-lg">
        <WorldMap map={map} tones={STORIES} label={t("atlasMap")} />
      </div>
      <p className="flex items-baseline justify-between gap-2 px-1.5 pt-2.5 pb-0.5">
        <span className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em] tabular-nums">{t("atlasCountries", { count: STORIES.size })}</span>
        <span className="text-sm text-muted-foreground">{t("atlasContinents", { count: CONTINENTS })}</span>
      </p>
    </Reveal>
  );
}
