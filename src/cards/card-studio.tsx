"use client";

import { DownloadIcon, Share2Icon, StarIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { cardShareUrl, clampReview, cycle, finalReview, localDateString, nextRating, reviewLength } from "@/core/cards/edit";
import { REVIEW_MAX_CHARS, type CardData, type CardSize } from "@/core/cards/types";
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

const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
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
      setTemplate((cur) => cycle(TEMPLATE_IDS, cur, dx < 0 ? 1 : -1));
    }
  }

  function filename() {
    const slug = data.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "card";
    return `mystonie-${slug}-${template}.png`;
  }

  function download() {
    if (png) downloadBlob(png, filename());
  }

  // Must stay synchronous up to navigator.share(): iOS Safari rejects a share that awaits anything first.
  function share() {
    if (!png) return;
    const files = [new File([png], filename(), { type: "image/png" })];
    const withUrl = { files, url: cardShareUrl(window.location.href, template) };
    const payload = navigator.canShare(withUrl) ? withUrl : { files };
    if (!navigator.canShare(payload)) return download();
    navigator.share(payload).catch((error: unknown) => {
      // AbortError = the user closed the sheet. Anything else: fall back to saving the file.
      if (!(error instanceof DOMException && error.name === "AbortError")) download();
    });
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

      <div role="group" aria-label={t("size")} className="flex gap-2">
        {(["story", "feed"] as const).map((s) => (
          <Choice key={s} active={size === s} onClick={() => setSize(s)}>
            {t(`sizes.${s}`)}
          </Choice>
        ))}
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{t("rating")}</legend>
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => {
            const fill = rating === null ? 0 : rating >= star ? 1 : rating >= star - 0.5 ? 0.5 : 0;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setRating((r) => nextRating(r, star))}
                aria-label={t("rateStars", { count: star })}
                aria-pressed={rating === star || rating === star - 0.5}
                className="relative flex size-11 items-center justify-center"
              >
                <StarIcon className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
                {fill > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center" style={{ clipPath: fill === 0.5 ? "inset(0 50% 0 0)" : undefined }}>
                    <StarIcon className="size-7 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                  </span>
                )}
              </button>
            );
          })}
          <span aria-live="polite" className="ml-2 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            {rating !== null && t("ratingValue", { rating })}
          </span>
          {rating !== null && (
            <button type="button" onClick={() => setRating(null)} aria-label={t("clearRating")} className="ml-auto flex size-11 items-center justify-center rounded-full hover:bg-accent">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("ratingHint")}</p>
      </fieldset>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${ids}-review`} className="text-sm font-medium">
            {t("review")}
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("reviewCount", { count: reviewLength(review), max: REVIEW_MAX_CHARS })}
          </span>
        </div>
        <input
          id={`${ids}-review`}
          type="text"
          value={review}
          onChange={(e) => setReview(clampReview(e.target.value))}
          placeholder={t("reviewPlaceholder")}
          enterKeyHint="done"
          className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-date`} className="text-sm font-medium">
          {t("finishedDate")}
        </label>
        <input
          id={`${ids}-date`}
          type="date"
          value={finishedOn}
          max={localDateString(new Date())}
          // Clearing the native picker gives "": keep the last valid date instead.
          onChange={(e) => e.target.value && setFinishedOn(e.target.value)}
          className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex gap-2">
        {canShare && (
          <button type="button" onClick={share} disabled={!png} className={cn(actionClass, "bg-primary text-primary-foreground")}>
            <Share2Icon className="size-5" />
            {png ? t("share") : t("preparing")}
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={!png}
          className={cn(actionClass, canShare ? "border border-border" : "bg-primary text-primary-foreground")}
        >
          <DownloadIcon className="size-5" />
          {png || canShare ? t("download") : t("preparing")}
        </button>
      </div>
    </div>
  );
}

const actionClass = "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-medium disabled:opacity-60";

/** Whether this browser can share image files (mobile Safari / Chrome); false on the server and most desktops. */
function useCanShareFiles(): boolean {
  return useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
}

function noopSubscribe() {
  return () => {};
}

let canShareFilesCache: boolean | undefined;
function canShareFiles(): boolean {
  if (canShareFilesCache === undefined) {
    const probe = new File([new Uint8Array(1)], "card.png", { type: "image/png" });
    canShareFilesCache = typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  }
  return canShareFilesCache;
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
