import { NotebookPenIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { journalAbout } from "@/data/journal";
import { Link } from "@/i18n/navigation";

/** "In the Journal" on a title page (ADR 0051): the articles that show this title as a card, newest first. */
export async function TitleJournal({ kind, externalId }: { kind: string; externalId: string }) {
  const locale = await getLocale();
  const [articles, t] = await Promise.all([journalAbout(kind, externalId, locale), getTranslations("Journal")]);
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="title-journal" className="flex flex-col gap-2">
      <h2 id="title-journal" className="font-display text-lg font-bold">
        {t("about")}
      </h2>
      <ul className="flex flex-col gap-2">
        {articles.slice(0, 3).map((a) => (
          <li key={a.slug} lang={a.locale === locale ? undefined : a.locale}>
            <Link href={`/journal/${a.slug}`} className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border hover:ring-brand/50">
              <NotebookPenIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
              <span className="font-semibold">{a.meta.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
