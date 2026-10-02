// The Journal's articles (stage 4, ADR 0051): Markdown files in content/journal/<slug>/<locale>.md, read at build time
// (the pages are static). Server only. A file with a mistake fails the build with its path, so it never ships broken.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TitleKind } from "@/core/catalog/types";
import { articleKey } from "@/core/feed-news";
import {
  isJournalSlug,
  journalIndex,
  JournalError,
  journalTitles,
  parseJournal,
  readingMinutes,
  type JournalArticle,
  type JournalVersion,
} from "@/core/journal";
import { routing } from "@/i18n/routing";

const ROOT = path.join(process.cwd(), "content", "journal");

/** Drafts (`draft: true`) show in development and previews, never in production. */
export const showDrafts = () => process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production";

/** An article to list: its version for the reader, the reading time and the titles it shows as cards. */
export type JournalListItem = JournalVersion & { minutes: number; titles: { kind: TitleKind; externalId: string }[] };
type Loaded = JournalListItem & { article: JournalArticle };

let memo: Promise<Loaded[]> | null = null;

async function load(): Promise<Loaded[]> {
  const out: Loaded[] = [];
  const dirs = await readdir(ROOT, { withFileTypes: true }).catch(() => []);
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    if (!isJournalSlug(dir.name)) throw new JournalError(`content/journal/${dir.name}: folder names are lowercase-with-dashes`);
    for (const locale of routing.locales) {
      const file = path.join(ROOT, dir.name, `${locale}.md`);
      const source = await readFile(file, "utf8").catch(() => null);
      if (source === null) continue;
      try {
        const article = parseJournal(source);
        out.push({
          slug: dir.name,
          locale,
          meta: article.meta,
          minutes: readingMinutes(article.blocks),
          titles: journalTitles(article.blocks),
          article,
        });
      } catch (error) {
        if (error instanceof JournalError) throw new JournalError(`content/journal/${dir.name}/${locale}.md: ${error.message}`);
        throw error;
      }
    }
  }
  return out;
}

/** Every version of every article (re-read on each call in development, so edits show on reload). */
function all(): Promise<Loaded[]> {
  if (process.env.NODE_ENV === "development") return load();
  memo ??= load();
  return memo;
}

/** The articles to list in `locale` (its own version, else English), newest first. */
export async function journalList(locale: string): Promise<JournalListItem[]> {
  return journalIndex(await all(), locale, routing.defaultLocale, showDrafts());
}

/** The newest article as `articleKey` (the same in every language), for the Articles tab's dot (ADR 0074). */
export async function newestArticleKey(): Promise<string | null> {
  const newest = (await journalList(routing.defaultLocale))[0];
  return newest ? articleKey(newest.meta.date, newest.slug) : null;
}

/**
 * One article for `locale`: its own version, else the English one (`locale` then says which was found), and the
 * languages it's written in; null when there's no such article (or it's a draft in production).
 */
export async function journalArticle(slug: string, locale: string): Promise<{ article: JournalArticle; locale: string; locales: string[] } | null> {
  if (!isJournalSlug(slug)) return null;
  const versions = (await all()).filter((v) => v.slug === slug && (showDrafts() || !v.meta.draft));
  const found = versions.find((v) => v.locale === locale) ?? versions.find((v) => v.locale === routing.defaultLocale) ?? versions[0];
  return found ? { article: found.article, locale: found.locale, locales: versions.map((v) => v.locale) } : null;
}

/** Every published slug (static params and the sitemap). */
export async function journalSlugs(): Promise<string[]> {
  return [...new Set((await all()).filter((v) => showDrafts() || !v.meta.draft).map((v) => v.slug))];
}

/** Articles that show this title as a card, for the title page's "In the Journal" (newest first, in `locale`). */
export async function journalAbout(kind: string, externalId: string, locale: string): Promise<JournalListItem[]> {
  const slugs = new Set((await all()).filter((v) => v.titles.some((t) => t.kind === kind && t.externalId === externalId)).map((v) => v.slug));
  return (await journalList(locale)).filter((v) => slugs.has(v.slug));
}

/**
 * When `username` published articles (ms, one per article, from their dates): the writer's Byline sticker (ADR 0063).
 * Drafts never count, not even in development, since a sticker is never taken back.
 */
export async function journalBy(username: string): Promise<number[]> {
  const name = username.toLowerCase();
  const dates = new Map<string, number>();
  for (const v of await all()) {
    if (v.meta.draft || v.meta.profile !== name) continue;
    const at = Date.parse(v.meta.date);
    if (!Number.isNaN(at)) dates.set(v.slug, Math.min(dates.get(v.slug) ?? at, at));
  }
  return [...dates.values()];
}
