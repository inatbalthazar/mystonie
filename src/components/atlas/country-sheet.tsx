"use client";

import { CheckIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Sheet } from "@/components/sheet";
import { continentOf, FIRST_YEAR_MIN, PLACE_STATUSES, type Place, type PlaceStatus } from "@/core/atlas";
import type { CountryCode } from "@/core/countries";
import type { RegionKind } from "@/core/regions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { StoryCountry } from "./atlas-view";
import { Reveal } from "@/components/motion/reveal";

const STATUS_KEY = { been: "statusBeen", lived: "statusLived", want: "statusWant" } as const;

/** A country's regions on the Atlas (ADR 0060): what they are, how many, and how many are marked. */
export type CountryRegionCount = { kind: RegionKind; total: number; done: number };

/**
 * One country of the Atlas: been there, lived there or want to go (a tap saves it), the year of the first visit, its
 * states or provinces (a row to the country's own page, ADR 0060), and the stories from there in the collection.
 * Tapping the chosen status again changes nothing; "Take it off" removes it. Want to go and Take it off clear the
 * regions marked, so with any marked they ask first.
 */
export function CountrySheet({
  country,
  name,
  place,
  story,
  regions,
  thisYear,
  onSave,
  onClose,
}: {
  country: CountryCode | null;
  name: string;
  place: Place | null;
  story: StoryCountry | null;
  regions: CountryRegionCount | null;
  thisYear: number;
  onSave: (country: CountryCode, status: PlaceStatus | null, firstYear: number | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Atlas");
  const id = useId();
  const years = Array.from({ length: thisYear - FIRST_YEAR_MIN + 1 }, (_, i) => thisYear - i);
  // "want" or "remove" waiting for a yes, because it clears the regions marked.
  const [asking, setAsking] = useState<{ country: CountryCode; action: "want" | "remove" } | null>(null);
  const ask = asking?.country === country ? asking.action : null;
  const marked = place && place.status !== "want" ? (regions?.done ?? 0) : 0;

  function apply(action: "want" | "remove") {
    if (!country) return;
    setAsking(null);
    if (action === "want") onSave(country, "want", null);
    else {
      onSave(country, null, null);
      onClose();
    }
  }

  const confirm = ask && regions && (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3">
      <p className="text-sm">
        {t(ask === "want" ? "regionsClearWant" : "regionsClearRemove", {
          count: marked,
          one: t("kindOne", { kind: regions.kind }),
          many: t("kindMany", { kind: regions.kind }),
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => apply(ask)}
          className="min-h-11 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90"
        >
          {t(ask === "want" ? "regionsClearWantYes" : "regionsClearRemoveYes")}
        </button>
        <button
          type="button"
          onClick={() => setAsking(null)}
          className="min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-border hover:bg-card"
        >
          {t("regionsClearNo")}
        </button>
      </div>
    </div>
  );

  return (
    <Sheet open={country !== null} onClose={onClose} title={name} closeLabel={t("close")}>
      {country && (
        <div className="flex flex-col gap-5">
          <p className="-mt-3 text-sm text-muted-foreground">{t(`continents.${continentOf(country)}`)}</p>
          <div role="radiogroup" aria-label={t("statusLabel", { country: name })} className="grid grid-cols-3 gap-2">
            {PLACE_STATUSES.map((status) => {
              const on = place?.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (on) return;
                    if (status === "want" && marked > 0) return setAsking({ country, action: "want" });
                    setAsking(null);
                    onSave(country, status, status === "want" ? null : (place?.firstYear ?? null));
                  }}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-center text-sm leading-tight font-semibold ring-1",
                    on ? "bg-brand text-brand-foreground ring-brand" : "bg-card ring-border hover:bg-muted",
                  )}
                >
                  {on && <CheckIcon aria-hidden="true" className="size-4" />}
                  {t(STATUS_KEY[status])}
                </button>
              );
            })}
          </div>

          {ask === "want" && confirm}

          {place && place.status !== "want" && (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${id}-year`} className="text-sm font-semibold">
                {t("firstVisit")}
              </label>
              <select
                id={`${id}-year`}
                value={place.firstYear ?? ""}
                onChange={(e) => onSave(country, place.status, e.target.value ? Number(e.target.value) : null)}
                className="h-11 rounded-xl bg-card px-3 text-base ring-1 ring-border"
              >
                <option value="">{t("yearUnknown")}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {regions && (
            <Link
              href={`/collection/atlas/${country.toLowerCase()}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-border hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{t("kindTitle", { kind: regions.kind })}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{t("regionsDoneOf", { done: marked, total: regions.total })}</span>
                </span>
                {marked > 0 ? (
                  <Reveal className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="grow-w block h-full rounded-full bg-brand" style={{ width: `${(marked / regions.total) * 100}%` }} />
                  </Reveal>
                ) : (
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {t("regionsMark", { many: t("kindMany", { kind: regions.kind }) })}
                  </span>
                )}
              </span>
              <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          )}

          <section aria-labelledby={`${id}-stories`} className="flex flex-col gap-2 border-t border-dashed border-border pt-4">
            <h3 id={`${id}-stories`} className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
              {t("fromHere")}
            </h3>
            {story ? (
              <>
                <p className="text-sm">{t("fromHereCount", { count: story.count, country: name })}</p>
                <ul className="grid grid-cols-3 gap-3">
                  {story.titles.map((title, i) => (
                    <li key={title.id} className={i % 2 ? "rotate-[1.5deg]" : "rotate-[-1.5deg]"}>
                      <Link href={title.href} className="block">
                        <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
                          {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes="110px" className="object-cover" />}
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-xs font-medium">{title.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("fromHereNone")}</p>
            )}
          </section>

          {ask === "remove" && confirm}
          {place && ask !== "remove" && (
            <button
              type="button"
              onClick={() => (marked > 0 ? setAsking({ country, action: "remove" }) : apply("remove"))}
              className="flex min-h-11 items-center self-start text-sm font-semibold text-destructive underline-offset-2 hover:underline"
            >
              {t("remove")}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
