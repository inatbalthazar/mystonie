"use client";

import { StarIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { clampReview, nextRating, reviewLength } from "@/core/cards/edit";
import { REVIEW_MAX_CHARS } from "@/core/cards/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20";

/** Five stars with half steps (tap a full star again for a half), plus clear. Shared by the card maker and the celebration. */
export function RatingField({ rating, onChange }: { rating: number | null; onChange: (rating: number | null) => void }) {
  const t = useTranslations("Card");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold">{t("rating")}</legend>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = rating === null ? 0 : rating >= star ? 1 : rating >= star - 0.5 ? 0.5 : 0;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(nextRating(rating, star))}
              aria-label={t("rateStars", { count: star })}
              aria-pressed={rating === star || rating === star - 0.5}
              className="relative flex size-11 items-center justify-center"
            >
              <StarIcon className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
              {fill > 0 && (
                <span className="absolute inset-0 flex items-center justify-center" style={{ clipPath: fill === 0.5 ? "inset(0 50% 0 0)" : undefined }}>
                  <StarIcon className="size-7 fill-brand text-brand" strokeWidth={1.5} />
                </span>
              )}
            </button>
          );
        })}
        <span aria-live="polite" className="ml-2 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {rating !== null && t("ratingValue", { rating })}
        </span>
        {rating !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("clearRating")}
            className="ml-auto flex size-11 items-center justify-center rounded-full hover:bg-accent"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("ratingHint")}</p>
    </fieldset>
  );
}

/**
 * A game's hours played (S3 games): whole hours, optional. Left empty, the card shows the game's average playtime
 * (`average`, RAWG's) when there is one.
 */
export function HoursField({ hours, onChange, average }: { hours: string; onChange: (hours: string) => void; average: number | null }) {
  const t = useTranslations("Card");
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {t("hoursLabel")}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={hours}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4))}
        placeholder={average ? String(average) : undefined}
        aria-describedby={hintId}
        enterKeyHint="done"
        className={cn(inputClass, "tabular-nums")}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        {average ? t("hoursHintAverage", { hours: average }) : t("hoursHint")}
      </p>
    </div>
  );
}

/** One-line review, cut to what fits on a card. */
export function ReviewField({ review, onChange }: { review: string; onChange: (review: string) => void }) {
  const t = useTranslations("Card");
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {t("review")}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("reviewCount", { count: reviewLength(review), max: REVIEW_MAX_CHARS })}
        </span>
      </div>
      <input
        id={id}
        type="text"
        value={review}
        onChange={(e) => onChange(clampReview(e.target.value))}
        placeholder={t("reviewPlaceholder")}
        enterKeyHint="done"
        className={inputClass}
      />
    </div>
  );
}
