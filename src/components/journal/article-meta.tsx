import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { JournalMeta } from "@/core/journal";

/** The name of `written` in the reader's language ("English", "อังกฤษ"). */
export async function languageName(written: string): Promise<string> {
  return new Intl.DisplayNames([await getLocale()], { type: "language" }).of(written) ?? written;
}

/**
 * "1 October 2026 · 4 min read", with "In English" when the article isn't in the reader's language (`written` is the
 * one shown) and "Draft" off production.
 */
export async function ArticleMeta({ meta, minutes, written }: { meta: JournalMeta; minutes: number; written: string | null }) {
  const [t, format] = await Promise.all([getTranslations("Journal"), getFormatter()]);
  const date = format.dateTime(new Date(`${meta.date}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" });
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <time dateTime={meta.date}>{date}</time>
      <span aria-hidden="true">·</span>
      <span>{t("readTime", { minutes })}</span>
      {written && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("inLanguage", { language: await languageName(written) })}</span>}
      {meta.draft && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{t("draft")}</span>}
    </span>
  );
}
