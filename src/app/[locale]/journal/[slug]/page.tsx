import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArticleActionsBar } from "@/components/journal/article-actions-bar";
import { ArticleBody } from "@/components/journal/article-body";
import { ArticleMeta, languageName } from "@/components/journal/article-meta";
import { Byline } from "@/components/journal/byline";
import { localizedPath } from "@/core/auth";
import { readingMinutes } from "@/core/journal";
import { journalArticle, journalSlugs } from "@/data/journal";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

// Built from content/journal/ (ADR 0051). Title cards come from the catalog cache, refreshed once a day.
export const dynamicParams = false;
export const revalidate = 86400;

export async function generateStaticParams() {
  return (await journalSlugs()).map((slug) => ({ slug }));
}

/** The URL of this article in `locale`, absolute. */
function articleUrl(slug: string, locale: string): string {
  if (!hasLocale(routing.locales, locale)) throw new Error(`not a locale: ${locale}`);
  return new URL(getPathname({ href: `/journal/${slug}`, locale }), siteUrl()).href;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/journal/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await journalArticle(slug, locale);
  if (!found) return {};
  const { meta } = found.article;
  // Each language has its own URL only where the article is written in it; a fallback points to the original.
  const languages = Object.fromEntries(found.locales.map((l) => [l, articleUrl(slug, l)]));
  return {
    title: `${meta.title} · Mystonie`,
    description: meta.description,
    alternates: {
      canonical: articleUrl(slug, found.locale),
      languages: { ...languages, "x-default": articleUrl(slug, found.locales.includes(routing.defaultLocale) ? routing.defaultLocale : found.locale) },
    },
    openGraph: {
      type: "article",
      title: meta.title,
      description: meta.description,
      publishedTime: meta.date,
      ...(meta.cover ? { images: [new URL(meta.cover, siteUrl()).href] } : {}),
    },
    ...(meta.draft ? { robots: { index: false, follow: false } } : {}),
  };
}

/** One Journal article (stage 4, ADR 0051), in the reader's language when written in it, else in English. */
export default async function JournalArticlePage({ params }: PageProps<"/[locale]/journal/[slug]">) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const found = await journalArticle(slug, locale);
  if (!found) notFound();
  const t = await getTranslations("Journal");
  const { meta, blocks } = found.article;
  const fallback = found.locale !== locale;
  const author = meta.author ?? t("defaultAuthor");
  // Article data for search engines; `<` is escaped so the text can't close the script.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    inLanguage: found.locale,
    author: {
      "@type": meta.author ? "Person" : "Organization",
      name: author,
      ...(meta.profile ? { url: new URL(getPathname({ href: `/u/${meta.profile}`, locale }), siteUrl()).href } : {}),
    },
    publisher: { "@type": "Organization", name: "Mystonie" },
    ...(meta.cover ? { image: new URL(meta.cover, siteUrl()).href } : {}),
  }).replace(/</g, "\\u003c");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {fallback && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("fallbackNote", { language: await languageName(found.locale) })}</p>}
      <article lang={fallback ? found.locale : undefined} className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">{meta.title}</h1>
          <p className="text-lg text-muted-foreground">{meta.description}</p>
          <div className="flex flex-col gap-2">
            <Byline author={meta.author} avatar={meta.avatar} profile={meta.profile} page className="self-start" />
            <ArticleMeta meta={meta} minutes={readingMinutes(blocks)} written={null} />
          </div>
        </header>
        {meta.cover && (
          <span className="relative block aspect-[2/1] w-full rotate-[-0.8deg] overflow-hidden rounded-2xl bg-muted shadow-md ring-4 ring-card">
            <Image src={meta.cover} alt="" fill priority unoptimized sizes="(min-width: 672px) 640px, 100vw" className="object-cover" />
          </span>
        )}
        <ArticleBody blocks={blocks} />
      </article>
      <ArticleActionsBar slug={slug} title={meta.title} next={localizedPath(`/journal/${slug}`, locale, routing.defaultLocale)} />
    </main>
  );
}
