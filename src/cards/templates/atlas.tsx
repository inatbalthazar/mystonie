import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { RegionMap, regionName, useRegionMap } from "@/components/atlas/region-map";
import { WorldMap, useWorldMap, type MapPalette, type MapTone } from "@/components/atlas/world-map";
import type { CardAtlasRegions, Palette } from "@/core/cards/types";
import { countryName, type CountryCode } from "@/core/countries";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, useCardName, useHeadline, useStats, type TemplateProps } from "../parts";

/** The map in the card's colours: land a shade of the ink, what you've been to in the accent. */
const mapColours = (palette: Palette): MapPalette => ({
  sea: palette.paper,
  land: `color-mix(in oklab, ${palette.ink} 16%, ${palette.paper})`,
  edge: palette.paper,
  been: palette.accent,
  lived: palette.accent,
  want: palette.accent,
  stories: [palette.accent, palette.accent, palette.accent, palette.accent],
});

/**
 * The Atlas card (stage 4, ADR 0059): a scratch map pasted into the album, the countries you've been to coloured in
 * with the card's accent and zoomed to them (the whole world when they spread far), and the numbers under it. A
 * country's card (ADR 0060) is the same page with that country's map and the regions you've been to. The maps load
 * with the page that shares them, before any card.
 */
export function AtlasCard(props: TemplateProps) {
  const regions = props.data.atlas?.regions;
  return regions ? <RegionsCard {...props} regions={regions} /> : <WorldCard {...props} />;
}

function WorldCard({ data, size, palette, host }: TemplateProps) {
  const map = useWorldMap();
  const name = useCardName(data);
  const locale = useLocale();
  const story = size === "story";
  const collator = new Intl.Collator(locale);
  const countries = data.atlas?.countries ?? [];
  // The story size has room for the countries by name, under the map.
  const names = story ? countries.map((code) => countryName(code, locale)).sort(collator.compare) : [];
  const tones = new Map<string, MapTone>(countries.map((code) => [code, "been"]));
  return (
    <Layout data={data} size={size} palette={palette} host={host} names={names}>
      <WorldMap
        map={map}
        tones={tones}
        palette={mapColours(palette)}
        focus={{ codes: countries, aspect: story ? 1.05 : 1.9 }}
        label={name}
        className="rounded-[4px]"
      />
    </Layout>
  );
}

function RegionsCard({ data, size, palette, host, regions }: TemplateProps & { regions: CardAtlasRegions }) {
  const map = useRegionMap(regions.country as CountryCode);
  const name = useCardName(data);
  const locale = useLocale();
  const story = size === "story";
  const ready = map && map !== "error" ? map : null;
  const marked = new Set(regions.ids);
  const collator = new Intl.Collator(locale);
  const names =
    story && ready
      ? ready.regions
          .filter((r) => marked.has(r.id))
          .map((r) => regionName(r, locale))
          .sort(collator.compare)
      : [];
  return (
    <Layout data={data} size={size} palette={palette} host={host} names={names}>
      {ready ? (
        <RegionMap
          map={ready}
          marked={marked}
          palette={mapColours(palette)}
          label={name}
          // Tall countries keep to the room the card has.
          className={cn("mx-auto rounded-[4px]", story ? "max-h-[900px]" : "max-h-[520px]")}
        />
      ) : (
        <div className={story ? "h-[900px]" : "h-[520px]"} />
      )}
    </Layout>
  );
}

function Layout({ data, size, palette, host, names, children }: TemplateProps & { names: string[]; children: ReactNode }) {
  const headline = useHeadline(data);
  const name = useCardName(data);
  const stats = useStats(data);
  const story = size === "story";
  return (
    <CardRoot size={size} palette={palette} className={cn("px-[72px] pb-[64px]", story ? "gap-[60px] pt-[120px]" : "gap-[34px] pt-[64px]")}>
      <header className="flex flex-col gap-[12px]">
        <p className="text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase [&:lang(th)]:tracking-normal">{headline}</p>
        <p
          data-fit=""
          className={cn(
            DISPLAY,
            "truncate font-extrabold tracking-[-0.04em] [font-stretch:75%]",
            story ? "text-[170px]" : "text-[130px]",
            "leading-[0.9]",
          )}
        >
          {name}
        </p>
      </header>

      {/* The map, taped in at a slight angle, in the middle of the room left. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[44px]">
        <div className="relative -rotate-[1.2deg] rounded-[10px] bg-[var(--card-paper)] p-[18px] shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
          <span aria-hidden="true" className="absolute -top-[22px] left-[42%] h-[48px] w-[170px] rotate-[-4deg] bg-white/55 shadow-sm" />
          {children}
        </div>
        {names.length > 0 && (
          <p className="line-clamp-5 [font-family:var(--card-hand)] text-[72px] leading-[1.15] text-[var(--card-text)]/90">{names.join(" · ")}</p>
        )}
      </div>

      {stats.length > 0 && (
        <dl
          className={cn(
            "grid shrink-0 gap-[28px] border-t-[4px] border-[var(--card-text)]/20 pt-[32px]",
            stats.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd
                data-fit=""
                className={cn(
                  DISPLAY,
                  "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]",
                  story ? "text-[140px]" : "text-[104px]",
                  "leading-[0.9]",
                )}
              >
                {s.value}
              </dd>
              <dt className="mt-[10px] line-clamp-2 text-[28px] leading-tight tracking-[0.1em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
