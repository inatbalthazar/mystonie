import { FreshPage } from "@/components/motion/fresh-page";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AtlasView, type StoryCountry } from "@/components/atlas/atlas-view";
import type { CountryRegionCount } from "@/components/atlas/country-sheet";
import { ShelfTabs } from "@/components/collection/collection-header";
import { SwipeArea } from "@/components/motion/swipe-area";
import { storiesByCountry } from "@/core/atlas";
import { regionsByCountry, regionsOf } from "@/core/atlas-regions";
import { localizedPath } from "@/core/auth";
import { COUNTRY_CODES, countryName, countryOptions, isCountryCode, type CountryCode } from "@/core/countries";
import { storyTitles, userPlaces, userRegions } from "@/data/atlas";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/** Posters a country keeps for its sheet; the rest are only counted. */
const STORY_POSTERS = 6;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Atlas");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * The Atlas (stage 4, ADR 0059), the collection's fourth tab after Watch · Read · Play: the places you've collected
 * (been to, lived in, want to go to) and the countries your stories come from, on one world map. Its own page; the
 * album shows the Been layer when the owner turns "Show my Atlas on my profile" on.
 */
export default async function AtlasPage({ params, searchParams }: PageProps<"/[locale]/collection/atlas">) {
  const locale = (await params).locale as Locale;
  // `?country=JP` opens that country's sheet (a Journal article's Check on a place, ADR 0092).
  const asked = (await searchParams).country;
  const openCountry = typeof asked === "string" && isCountryCode(asked.toUpperCase()) ? (asked.toUpperCase() as CountryCode) : null;
  setRequestLocale(locale);
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId)
    return redirect({ href: { pathname: "/auth", query: { next: localizedPath("/collection/atlas", locale, routing.defaultLocale) } }, locale });

  const [{ data: profile, error }, places, titles, marked, t] = await Promise.all([
    db.from("profiles").select("username, visibility, atlas_public").eq("id", userId).single(),
    userPlaces(db, userId),
    storyTitles(db, userId),
    userRegions(db, userId),
    getTranslations("Collection"),
  ]);
  if (error) throw new Error(`profile read failed: ${error.message}`);
  const stories: StoryCountry[] = [...storiesByCountry(titles)].map(([code, list]) => ({
    code,
    count: list.length,
    titles: list.slice(0, STORY_POSTERS),
  }));
  // Every country with regions (its sheet links to them), with how many the viewer marked.
  const markedBy = regionsByCountry(marked);
  const regions: Partial<Record<CountryCode, CountryRegionCount>> = {};
  for (const code of COUNTRY_CODES) {
    const list = regionsOf(code);
    if (list) regions[code] = { kind: list.kind, total: list.ids.length, done: markedBy.get(code)?.length ?? 0 };
  }
  const options = countryOptions(locale).map(([code, name]) => [code, name, countryName(code, "en")] as const);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pt-10 pb-28">
      <FreshPage />
      {/* Stays put while the Atlas and the shelves trade places (ADR 0081). */}
      <h1 data-stay="collection-title" className="font-display text-4xl font-extrabold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <div className="flex flex-col gap-6">
        <ShelfTabs shelf="atlas" />
        {/* Swiping right goes back to Play, the shelf before (ADR 0070); the map keeps its own drags. */}
        <SwipeArea prev="/collection?shelf=play">
          <AtlasView
            initialPlaces={places}
            stories={stories}
            regions={regions}
            options={options}
            thisYear={new Date().getUTCFullYear()}
            initialOpen={openCountry}
            atlasPublic={profile.atlas_public}
            profilePublic={profile.visibility === "public"}
            username={profile.username}
            host={siteUrl().host}
          />
        </SwipeArea>
      </div>
    </main>
  );
}
