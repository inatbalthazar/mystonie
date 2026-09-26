import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "next-intl";
import { TitlePicker } from "@/components/title-picker";
import type { SearchResult } from "@/core/catalog/types";
import { trendingTitles } from "@/data/tmdb";

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

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, trending] = await Promise.all([getTranslations("Home"), loadTrending()]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 pt-16 pb-8">
      <header className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg">{t("tagline")}</p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      <TitlePicker trending={trending.slice(0, 12)} />
    </main>
  );
}
