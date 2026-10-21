"use client";

import { ChevronLeftIcon, ChevronRightIcon, GlobeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { regionName, useRegionMap } from "@/components/atlas/region-map";
import { regionsOf } from "@/core/atlas-regions";
import { countryName, countryOptions, type CountryCode } from "@/core/countries";
import type { RankItem } from "@/core/rankings";
import { cn } from "@/lib/utils";

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Places for a ranking (ADR 0099): search the countries (in the viewer's language or in English), then take the whole
 * country, or open it and pick one of its regions (provinces, states, prefectures…) from the Atlas's maps.
 */
export function PlacePicker({ taken, onPick }: { taken: ReadonlySet<string>; onPick: (item: RankItem) => void }) {
  const t = useTranslations("Rank");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<CountryCode | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [country]);
  const all = useMemo(() => countryOptions(locale).map(([code, name]) => ({ code, name, en: countryName(code, "en") })), [locale]);
  const q = fold(query.trim());
  const shown = q ? all.filter((c) => fold(c.name).includes(q) || fold(c.en).includes(q)) : all;

  if (country) return <RegionPick country={country} taken={taken} onPick={onPick} onBack={() => setCountry(null)} />;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("placesLabel")}
        placeholder={t("placesPlaceholder")}
        autoComplete="off"
        className="h-12 rounded-xl border border-input bg-card px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
      />
      <ul className="flex max-h-[55dvh] flex-col divide-y divide-dashed divide-border overflow-y-auto">
        {shown.map((c) => {
          const ref = `country:${c.code}`;
          return (
            <li key={c.code} className="flex items-center gap-2 py-1">
              <button
                type="button"
                disabled={taken.has(ref)}
                onClick={() => onPick({ ref, kind: "country", name: c.name })}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left font-semibold hover:text-brand disabled:opacity-40"
              >
                <GlobeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{c.name}</span>
              </button>
              {regionsOf(c.code) && (
                <button
                  type="button"
                  onClick={() => setCountry(c.code)}
                  aria-label={t("openRegions", { country: c.name })}
                  className="flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted-foreground ring-1 ring-border hover:text-brand"
                >
                  {t("regions")}
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RegionPick({ country, taken, onPick, onBack }: { country: CountryCode; taken: ReadonlySet<string>; onPick: (item: RankItem) => void; onBack: () => void }) {
  const t = useTranslations("Rank");
  const locale = useLocale();
  const map = useRegionMap(country);
  const [query, setQuery] = useState("");
  const name = countryName(country, locale);
  const q = fold(query.trim());
  const regions = map && map !== "error" ? [...map.regions].sort((a, b) => regionName(a, locale).localeCompare(regionName(b, locale), locale)) : [];
  const shown = q ? regions.filter((r) => fold(regionName(r, locale)).includes(q) || fold(r.en).includes(q)) : regions;

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-brand">
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t("allCountries")}
      </button>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("regionsSearch", { country: name })}
        placeholder={t("regionsSearch", { country: name })}
        autoComplete="off"
        className="h-12 rounded-xl border border-input bg-card px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
      />
      {map === null && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {map === "error" && <p className="text-sm text-destructive">{t("loadError")}</p>}
      <ul className="flex max-h-[55dvh] flex-col divide-y divide-dashed divide-border overflow-y-auto">
        {shown.map((r) => {
          const ref = `region:${r.id}`;
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={taken.has(ref)}
                onClick={() => onPick({ ref, kind: "region", name: regionName(r, locale) })}
                className={cn("flex min-h-11 w-full items-center rounded-lg px-1 text-left font-semibold hover:text-brand disabled:opacity-40")}
              >
                <span className="truncate">{regionName(r, locale)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
