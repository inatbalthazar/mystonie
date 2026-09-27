"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { CARD_DIMENSIONS, type CardData, type CardSize, type Palette } from "@/core/cards/types";
import { ensureCardFonts } from "./fonts";
import { CardTemplate, type TemplateId } from "./registry";

type Props = {
  template: TemplateId;
  data: CardData;
  size: CardSize;
  palette: Palette;
  host: string;
  /** Receives the unscaled card node (what gets exported). */
  cardRef?: Ref<HTMLDivElement>;
};

/** Renders a card at export size and scales it down to the container width. */
export function CardPreview({ template, data, size, palette, host, cardRef }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { width: w, height: h } = CARD_DIMENSIONS[size];

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const recapNames = data.recap?.titles.map((t) => t.name).join(" ");
  useEffect(() => {
    void ensureCardFonts(data.name, data.review, recapNames);
  }, [data.name, data.review, recapNames]);

  const scale = width / w;

  return (
    <div ref={outer} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${w} / ${h}` }}>
      {width > 0 && (
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <div ref={cardRef}>
            <CardTemplate id={template} data={data} size={size} palette={palette} host={host} />
          </div>
        </div>
      )}
    </div>
  );
}
