"use client";

import { GlobeIcon, MapPinIcon, Share2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Celebration } from "@/components/celebration";
import { StonieHop } from "@/components/motion/stonie-hop";
import { PaperCard } from "@/components/paper-card";
import { SettingSwitch } from "@/components/settings/setting-switch";
import {
  atlasCardCountries,
  atlasSummary,
  isVisited,
  placesByContinent,
  storyLevel,
  type Place,
  type PlaceStatus,
  type StoryTitle,
} from "@/core/atlas";
import type { CardData } from "@/core/cards/types";
import type { CountryCode } from "@/core/countries";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { CountrySearch } from "./country-search";
import { CountrySheet, type CountryRegionCount } from "./country-sheet";
import { useWorldMap, WorldMap, type MapTone, type MapView } from "./world-map";
import { Reveal } from "@/components/motion/reveal";

/** A country of the Stories layer: how many stories come from it, and the first few for its sheet. */
export type StoryCountry = { code: CountryCode; count: number; titles: StoryTitle[] };

type Layer = "been" | "stories";

const VIEWS: readonly MapView[] = ["world", "africa", "asia", "europe", "north_america", "south_america", "oceania"];

const chip = "flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ring-1 transition-colors";
const chipOn = "bg-foreground text-background ring-foreground";
const chipOff = "bg-card text-muted-foreground ring-border hover:text-foreground";

/**
 * The Atlas (stage 4, ADR 0059): two layers on one world map. Been: the countries you've been to (coral), lived in
 * (darker) and want to go to (hatched), added by tapping the map or searching, each with an optional first-visit
 * year. Stories: the countries your movies, series and manga come from, more stories in a stronger teal. Continent
 * chips zoom in (small countries are dots). Changes save at once and roll back if they fail.
 */
export function AtlasView({
  initialPlaces,
  stories,
  options,
  regions: initialRegions,
  thisYear,
  atlasPublic,
  profilePublic,
  username,
  host,
  initialOpen = null,
}: {
  initialPlaces: Place[];
  stories: StoryCountry[];
  /** Countries with regions (ADR 0060): what they are, how many, and how many the viewer marked. */
  regions: Partial<Record<CountryCode, CountryRegionCount>>;
  options: readonly (readonly [CountryCode, string, string])[];
  thisYear: number;
  atlasPublic: boolean;
  profilePublic: boolean;
  username: string | null;
  host: string;
  /** A country whose sheet is open from the start (`?country=`, a Journal article's Check, ADR 0092). */
  initialOpen?: CountryCode | null;
}) {
  const t = useTranslations("Atlas");
  const locale = useLocale();
  const map = useWorldMap();
  const [places, setPlaces] = useState<ReadonlyMap<CountryCode, Place>>(() => new Map(initialPlaces.map((p) => [p.country, p])));
  const [layer, setLayer] = useState<Layer>("been");
  const [view, setView] = useState<MapView>("world");
  const [open, setOpen] = useState<CountryCode | null>(initialOpen);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState<CardData | null>(null);
  const [regions, setRegions] = useState(initialRegions);

  const names = useMemo(() => new Map(options.map(([code, name]) => [code, name])), [options]);
  const nameOf = (code: CountryCode) => names.get(code) ?? code;
  const storyOf = useMemo(() => new Map(stories.map((s) => [s.code, s])), [stories]);
  const list = [...places.values()];
  const summary = atlasSummary(list, storyOf.keys());
  const tones = new Map<string, MapTone>(
    layer === "been" ? list.map((p) => [p.country, p.status]) : stories.map((s) => [s.code, storyLevel(s.count)]),
  );

  async function save(country: CountryCode, status: PlaceStatus | null, firstYear: number | null) {
    const before = places;
    const regionsBefore = regions;
    const next = new Map(places);
    if (status) next.set(country, { country, status, firstYear: status === "want" ? null : firstYear });
    else next.delete(country);
    setPlaces(next);
    // Taking a country off, or to Want to go, clears its regions (the server does the same).
    const counted = regions[country];
    if (counted && counted.done > 0 && (!status || status === "want")) setRegions({ ...regions, [country]: { ...counted, done: 0 } });
    setError(false);
    track("place_saved", { status: status ?? "removed" });
    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, status, firstYear: status && status !== "want" ? firstYear : null }),
    }).catch(() => null);
    if (!res?.ok) {
      setPlaces(before);
      setRegions(regionsBefore);
      setError(true);
    }
  }

  function select(code: string) {
    if (names.has(code as CountryCode)) setOpen(code as CountryCode);
  }

  const visited = list.filter(isVisited);
  const wanted = list.filter((p) => p.status === "want");

  // The Atlas card: the visited countries on the map, made when Share is tapped (today's date in the viewer's zone).
  function share() {
    setSharing({
      kind: "movie",
      name: t("title"),
      posterUrl: null,
      finishedOn: new Date().toLocaleDateString("en-CA"),
      atlas: { countries: atlasCardCountries(list), stories: summary.stories },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-2">
        {[
          { key: "countries", value: summary.been, label: t("statCountries", { count: summary.been }) },
          { key: "continents", value: summary.continents, label: t("statContinents", { count: summary.continents }) },
          { key: "stories", value: summary.stories, label: t("statStories", { count: summary.stories }) },
        ].map((s, i) => (
          <div
            key={s.key}
            className={cn("flex flex-col rounded-2xl bg-card px-3 py-3 ring-1 ring-border", i === 1 ? "rotate-[0.8deg]" : "-rotate-[0.6deg]")}
          >
            <dd className="font-display text-3xl leading-none font-extrabold tabular-nums">{s.value}</dd>
            <dt className="mt-1 text-xs leading-tight text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>

      <div role="group" aria-label={t("layersLabel")} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["been", "stories"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={layer === l}
            onClick={() => setLayer(l)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold",
              layer === l ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground",
            )}
          >
            {l === "been" ? <MapPinIcon aria-hidden="true" className="size-4" /> : <GlobeIcon aria-hidden="true" className="size-4" />}
            {t(l === "been" ? "layerBeen" : "layerStories")}
          </button>
        ))}
      </div>

      <section aria-label={t("mapLabel")} className="flex flex-col gap-3">
        <div role="group" aria-label={t("zoomLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1 [scrollbar-width:none]">
          {VIEWS.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn(chip, view === v ? chipOn : chipOff)}>
              {v === "world" ? t("world") : t(`continents.${v}`)}
            </button>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-border">
          <WorldMap
            map={map}
            tones={tones}
            view={view}
            selected={open}
            onSelect={select}
            label={layer === "been" ? t("mapBeenAlt", { count: summary.been }) : t("mapStoriesAlt", { count: summary.stories })}
            className="text-foreground"
          />
          {!map && (
            <p className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <StonieHop />
              {t("loadingMap")}
            </p>
          )}
        </div>
        <Legend layer={layer} />
      </section>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t(layer === "been" ? "addHint" : "storiesHint")}</p>
        <CountrySearch options={options} onPick={(code) => setOpen(code)} />
        <p aria-live="polite" className={cn("text-sm text-destructive", !error && "sr-only")}>
          {error ? t("saveError") : ""}
        </p>
      </div>

      {layer === "been" ? (
        <>
          {visited.length === 0 && wanted.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center font-hand text-2xl text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <>
              {visited.length > 0 && (
                <PlaceGroups
                  title={t("beenTitle", { count: visited.length })}
                  places={visited}
                  regions={regions}
                  nameOf={nameOf}
                  locale={locale}
                  onOpen={setOpen}
                />
              )}
              {wanted.length > 0 && (
                <PlaceGroups
                  title={t("wantTitle", { count: wanted.length })}
                  places={wanted}
                  regions={{}}
                  nameOf={nameOf}
                  locale={locale}
                  onOpen={setOpen}
                />
              )}
            </>
          )}
          {summary.both > 0 && (
            <p className="font-hand text-2xl leading-tight text-brand">{t("bothLine", { both: summary.both, been: summary.been })}</p>
          )}
        </>
      ) : (
        <StoryList stories={stories} nameOf={nameOf} onOpen={setOpen} />
      )}

      <PaperCard className="flex flex-col gap-4">
        <button
          type="button"
          onClick={share}
          disabled={visited.length === 0 || !map}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50"
        >
          <Share2Icon className="size-4" aria-hidden="true" />
          {t("share")}
        </button>
        {visited.length === 0 && <p className="-mt-2 text-sm text-muted-foreground">{t("shareEmpty")}</p>}
        <SettingSwitch setting="atlasPublic" initial={atlasPublic} />
        {!profilePublic && <p className="-mt-2 text-sm text-muted-foreground">{t("profilePrivate")}</p>}
      </PaperCard>

      <CountrySheet
        country={open}
        name={open ? nameOf(open) : ""}
        place={open ? (places.get(open) ?? null) : null}
        story={open ? (storyOf.get(open) ?? null) : null}
        regions={open ? (regions[open] ?? null) : null}
        thisYear={thisYear}
        onSave={save}
        onClose={() => setOpen(null)}
      />
      {sharing && (
        <Celebration data={sharing} source={{ kind: "atlas", ready: true }} username={username} host={host} onClose={() => setSharing(null)} />
      )}
    </div>
  );
}

function Legend({ layer }: { layer: Layer }) {
  const t = useTranslations("Atlas");
  const swatch = "inline-block size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10";
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {layer === "been" ? (
        <>
          <li className="flex items-center gap-1.5">
            <span className={cn(swatch, "bg-brand")} />
            {t("statusBeen")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className={cn(swatch, "bg-[var(--atlas-lived)]")} />
            {t("statusLived")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className={cn(swatch, "bg-[repeating-linear-gradient(45deg,var(--brand)_0_2px,var(--atlas-land)_2px_5px)]")} />
            {t("statusWant")}
          </li>
        </>
      ) : (
        <li className="flex items-center gap-1.5">
          {t("fewer")}
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={swatch} style={{ background: `var(--atlas-story-${n})` }} />
          ))}
          {t("more")}
        </li>
      )}
    </ul>
  );
}

function PlaceGroups({
  title,
  places,
  regions,
  nameOf,
  locale,
  onOpen,
}: {
  title: string;
  places: Place[];
  regions: Partial<Record<CountryCode, CountryRegionCount>>;
  nameOf: (code: CountryCode) => string;
  locale: string;
  onOpen: (code: CountryCode) => void;
}) {
  const t = useTranslations("Atlas");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      {placesByContinent(places, nameOf, locale).map(([continent, group]) => (
        <div key={continent} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t(`continents.${continent}`)}</h3>
          <ul className="flex flex-wrap gap-2">
            {group.map((p, i) => (
              <li key={p.country}>
                <button
                  type="button"
                  onClick={() => onOpen(p.country)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full bg-card py-1 pr-4 pl-3 text-sm font-semibold shadow-sm ring-1 ring-border hover:bg-muted",
                    i % 2 ? "rotate-[0.8deg]" : "-rotate-[0.8deg]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3 shrink-0 rounded-full",
                      p.status === "been" && "bg-brand",
                      p.status === "lived" && "bg-[var(--atlas-lived)]",
                      p.status === "want" && "bg-[repeating-linear-gradient(45deg,var(--brand)_0_2px,var(--atlas-land)_2px_4px)]",
                    )}
                  />
                  {nameOf(p.country)}
                  {p.status === "lived" && <span className="text-xs font-normal text-muted-foreground">{t("livedTag")}</span>}
                  {p.firstYear && <span className="text-xs font-normal text-muted-foreground tabular-nums">{p.firstYear}</span>}
                  {!!regions[p.country]?.done && (
                    <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                      {t("regionsShort", { done: regions[p.country]!.done, total: regions[p.country]!.total })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function StoryList({
  stories,
  nameOf,
  onOpen,
}: {
  stories: StoryCountry[];
  nameOf: (code: CountryCode) => string;
  onOpen: (code: CountryCode) => void;
}) {
  const t = useTranslations("Atlas");
  if (stories.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center font-hand text-2xl text-muted-foreground">
        {t("storiesEmpty")}
      </p>
    );
  }
  const top = stories[0]!.count;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-extrabold">{t("storiesTitle", { count: stories.length })}</h2>
      <ul className="flex flex-col gap-2">
        {stories.map((s) => (
          <li key={s.code}>
            <button
              type="button"
              onClick={() => onOpen(s.code)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-card px-4 py-2.5 text-left ring-1 ring-border hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{nameOf(s.code)}</span>
                <Reveal className="mt-1 h-1.5 rounded-full bg-muted">
                  <span
                    className="grow-w block h-full rounded-full"
                    style={{ width: `${Math.max(6, (s.count / top) * 100)}%`, background: `var(--atlas-story-${storyLevel(s.count)})` }}
                  />
                </Reveal>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{t("storyCount", { count: s.count })}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("storiesSource")}</p>
    </section>
  );
}
