"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { CardData, CardSize } from "@/core/cards/types";
import { cn } from "@/lib/utils";
import { CardPreview } from "./card-preview";
import { downloadBlob, usePrerenderedCard } from "./export";
import { DEFAULT_TEMPLATE, TEMPLATES, type TemplateId } from "./registry";
import { usePosterPalette } from "./use-poster-palette";

type Props = {
  data: CardData;
  /** Small poster used only for palette extraction (faster than the card-size poster). */
  paletteSource?: string | null;
  host: string;
};

/** Card preview with template and size switches, and a pre-rendered PNG download. */
export function CardStudio({ data, paletteSource, host }: Props) {
  const t = useTranslations("Card");
  const [template, setTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [size, setSize] = useState<CardSize>("story");
  const palette = usePosterPalette(paletteSource ?? data.posterUrl);
  const cardRef = useRef<HTMLDivElement>(null);
  const png = usePrerenderedCard(cardRef, size, JSON.stringify([template, size, data, palette]));

  function download() {
    if (!png) return;
    const slug = data.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "card";
    downloadBlob(png, `mystonie-${slug}-${template}.png`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("template")} className="flex gap-2">
        {TEMPLATES.map(({ id }) => (
          <Choice key={id} active={template === id} onClick={() => setTemplate(id)}>
            {t(`templates.${id}`)}
          </Choice>
        ))}
      </div>
      <div role="group" aria-label={t("size")} className="flex gap-2">
        {(["story", "feed"] as const).map((s) => (
          <Choice key={s} active={size === s} onClick={() => setSize(s)}>
            {t(`sizes.${s}`)}
          </Choice>
        ))}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <CardPreview template={template} data={data} size={size} palette={palette} host={host} cardRef={cardRef} />
      </div>

      <button
        type="button"
        onClick={download}
        disabled={!png}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60"
      >
        <DownloadIcon className="size-5" />
        {png ? t("download") : t("preparing")}
      </button>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 flex-1 rounded-full border px-3 text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
