import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "next-intl";
import { ExampleCards } from "@/cards/example-cards";
import { TitlePicker } from "@/components/title-picker";
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import type { SearchResult } from "@/core/catalog/types";
import type { CardData } from "@/core/cards/types";
import { titleDetails, trendingTitles } from "@/data/tmdb";
import { siteUrl } from "@/lib/site";

// Trending changes daily; rebuild the page at most hourly.
export const revalidate = 3600;

async function loadTrending(): Promise<SearchResult[]> {
  try {
    return await trendingTitles();
  } catch (error) {
    // No token at build time, or TMDB down: the page still works with search only.
    console.warn(`Trending unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** Example cards: the top trending titles with real stats, or one sample without a poster. */
async function loadExamples(trending: SearchResult[], sample: CardData): Promise<CardData[]> {
  const finishedOn = new Date().toISOString().slice(0, 10);
  const top = trending.filter((r) => r.kind === "movie" || r.kind === "series").slice(0, 3);
  const cards = await Promise.all(
    top.map(async (r, i): Promise<CardData | null> => {
      const details = await titleDetails(r.kind as "movie" | "series", r.externalId).catch(() => null);
      if (!details) return null;
      const { title } = details;
      return {
        ...title,
        // Small posters: examples render at thumbnail size on the first screen.
        posterUrl: title.posterPath ? tmdbImageUrl(title.posterPath, "w342") : null,
        finishedOn,
        rating: i === 1 ? 4.5 : null,
        review: i === 1 ? sample.review : null,
      };
    }),
  );
  const found = cards.filter((c): c is CardData => c !== null);
  return found.length > 0 ? found : [{ ...sample, finishedOn }];
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, tc, trending] = await Promise.all([getTranslations("Home"), getTranslations("Card"), loadTrending()]);
  const host = siteUrl().host;
  const examples = await loadExamples(trending, {
    kind: "series",
    name: tc("sampleTitle"),
    episodeCount: 16,
    seasonCount: 1,
    runtimeMin: 60,
    rating: 4.5,
    review: tc("sampleReview"),
    finishedOn: "",
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 pt-16 pb-8">
      <header className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg">{t("tagline")}</p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      <ExampleCards examples={examples} host={host} />
      <TitlePicker trending={trending.slice(0, 12)} host={host} />
    </main>
  );
}
