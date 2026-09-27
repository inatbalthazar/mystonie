"use client";

import { DownloadIcon, Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { cardShareUrl, cycle, finalReview, localDateString } from "@/core/cards/edit";
import type { CardData, CardSize } from "@/core/cards/types";
import { WaitlistForm } from "@/components/waitlist-form";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useCanShareFiles } from "./can-share";
import { CardPreview } from "./card-preview";
import { RatingField, ReviewField } from "./fields";
import { downloadBlob, usePrerenderedCard } from "./export";
import { DEFAULT_TEMPLATE, FINISH_TEMPLATES, type TemplateId } from "./registry";
import { usePosterPalette } from "./use-poster-palette";

type Props = {
  data: CardData;
  /** Small poster used only for palette extraction (faster than the card-size poster). */
  paletteSource?: string | null;
  host: string;
};

const SWIPE_PX = 40;

/** Card editor: template (buttons or swipe), size, rating, review, date, then Share / Download. */
export function CardStudio({ data, paletteSource, host }: Props) {
  const t = useTranslations("Card");
  const ids = useId();
  const [template, setTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [size, setSize] = useState<CardSize>("story");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [finishedOn, setFinishedOn] = useState(data.finishedOn);
  const canShare = useCanShareFiles();
  // The waitlist ask comes after the card is out: celebrate first, ask later.
  const [delivered, setDelivered] = useState(false);

  // One card per picked title (the panel remounts the studio for each title).
  useEffect(() => {
    track("card_created", { kind: data.kind, tpl: DEFAULT_TEMPLATE });
  }, [data.kind]);

  function switchTemplate(next: TemplateId, via: "button" | "swipe") {
    if (next === template) return;
    setTemplate(next);
    track("template_switched", { tpl: next, via });
  }

  function switchSize(next: CardSize) {
    if (next === size) return;
    setSize(next);
    track("size_switched", { size: next });
  }

  const card: CardData = { ...data, rating, review: finalReview(review), finishedOn };
  const palette = usePosterPalette(paletteSource ?? data.posterUrl);
  const cardRef = useRef<HTMLDivElement>(null);
  const png = usePrerenderedCard(cardRef, size, JSON.stringify([template, size, card, palette]));

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: PointerEvent) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      switchTemplate(cycle(FINISH_TEMPLATES, template, dx < 0 ? 1 : -1), "swipe");
    }
  }

  function filename() {
    const slug = data.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "card";
    return `mystonie-${slug}-${template}.png`;
  }

  function download(fallback = false) {
    if (!png) return;
    downloadBlob(png, filename());
    setDelivered(true);
    track("card_downloaded", { tpl: template, size, fallback });
  }

  // Must stay synchronous up to navigator.share(): iOS Safari rejects a share that awaits anything first.
  function share() {
    if (!png) return;
    const files = [new File([png], filename(), { type: "image/png" })];
    const withUrl = { files, url: cardShareUrl(window.location.href, template) };
    const payload = navigator.canShare(withUrl) ? withUrl : { files };
    if (!navigator.canShare(payload)) return download(true);
    navigator.share(payload).then(
      () => {
        setDelivered(true);
        track("card_shared", { tpl: template, size });
      },
      (error: unknown) => {
        // AbortError = the user closed the sheet. Anything else: fall back to saving the file.
        if (!(error instanceof DOMException && error.name === "AbortError")) download(true);
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("template")} className="flex gap-1 rounded-full bg-muted p-1">
        {FINISH_TEMPLATES.map((id) => (
          <Choice key={id} active={template === id} onClick={() => switchTemplate(id, "button")}>
            {t(`templates.${id}`)}
          </Choice>
        ))}
      </div>

      <div
        className="mx-auto w-full max-w-sm touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
        onDragStart={(e) => e.preventDefault()}
      >
        <CardPreview template={template} data={card} size={size} palette={palette} host={host} cardRef={cardRef} />
        <p className="mt-2 text-center text-xs text-muted-foreground">{t("swipeHint")}</p>
      </div>

      <div role="group" aria-label={t("size")} className="mx-auto flex w-full max-w-xs gap-1 rounded-full bg-muted p-1">
        {(["story", "feed"] as const).map((s) => (
          <Choice key={s} active={size === s} onClick={() => switchSize(s)}>
            {t(`sizes.${s}`)}
          </Choice>
        ))}
      </div>

      <RatingField rating={rating} onChange={setRating} />
      <ReviewField review={review} onChange={setReview} />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-date`} className="text-sm font-semibold">
          {t("finishedDate")}
        </label>
        <input
          id={`${ids}-date`}
          type="date"
          value={finishedOn}
          max={localDateString(new Date())}
          // Clearing the native picker gives "": keep the last valid date instead.
          onChange={(e) => e.target.value && setFinishedOn(e.target.value)}
          className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      </div>

      <div className="flex gap-2">
        {canShare && (
          <button type="button" onClick={share} disabled={!png} className={cn(actionClass, "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90")}>
            <Share2Icon className="size-5" />
            {png ? t("share") : t("preparing")}
          </button>
        )}
        <button
          type="button"
          onClick={() => download()}
          disabled={!png}
          className={cn(actionClass, canShare ? "border border-input bg-background hover:bg-accent" : "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90")}
        >
          <DownloadIcon className="size-5" />
          {png || canShare ? t("download") : t("preparing")}
        </button>
      </div>

      {delivered && <WaitlistForm placement="after_card" />}
    </div>
  );
}

const actionClass = "flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition-colors disabled:opacity-60";

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-10 flex-1 rounded-full px-3 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
