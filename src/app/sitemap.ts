import type { MetadataRoute } from "next";
import { journalArticle, journalSlugs } from "@/data/journal";
import { featuredForSitemap } from "@/data/journal-posts";
import { adminClient } from "@/data/supabase-admin";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

// Refreshed daily, for members' Featured articles (ADR 0092).
export const revalidate = 86400;

// Public, indexable pages. Add new ones here as they ship.
const pages = ["/", "/feed", "/reel", "/pro", "/privacy", "/terms"] as const;

type Locale = (typeof routing.locales)[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (href: string, locale: Locale) => new URL(getPathname({ href, locale }), base).href;
  const entry = (href: string, locales: readonly Locale[], lastModified?: string): MetadataRoute.Sitemap[number] => {
    const main = locales.includes(routing.defaultLocale) ? routing.defaultLocale : locales[0]!;
    return {
      url: url(href, main),
      ...(lastModified ? { lastModified } : {}),
      alternates: {
        languages: { ...Object.fromEntries(locales.map((locale) => [locale, url(href, locale)])), "x-default": url(href, main) },
      },
    };
  };

  // Journal articles (ADR 0051): only the languages each is written in.
  const articles = await Promise.all(
    (await journalSlugs()).map(async (slug) => {
      const found = await journalArticle(slug, routing.defaultLocale);
      const locales = (found?.locales ?? []).filter((l): l is Locale => (routing.locales as readonly string[]).includes(l));
      return locales.length ? entry(`/journal/${slug}`, locales, found?.article.meta.date) : null;
    }),
  );
  // Members' Featured articles (ADR 0092), in the one language each is written in.
  const admin = adminClient();
  const featured = admin
    ? await featuredForSitemap(admin).catch((error: unknown) => {
        console.error(error);
        return [];
      })
    : [];
  const members = featured.flatMap((p) =>
    (routing.locales as readonly string[]).includes(p.locale) ? [entry(`/journal/u/${p.id}`, [p.locale as Locale], p.at)] : [],
  );
  return [...pages.map((href) => entry(href, routing.locales)), ...articles.filter((a) => a !== null), ...members];
}
