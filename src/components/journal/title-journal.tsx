import { NotebookPenIcon, PenLineIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { articlePath } from "@/core/journal-feed";
import { journalAbout } from "@/data/journal";
import { postsAbout } from "@/data/journal-posts";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";

/** Articles listed under a title, the team's and Featured members' together. */
const SHOWN = 3;

/**
 * "In the Journal" on a title page (ADR 0051): the team's articles that show this title as a card and Featured
 * members' articles about it (ADR 0092), newest first, then "Write about it", which starts an article about it.
 */
export async function TitleJournal({ kind, externalId }: { kind: string; externalId: string }) {
  const locale = await getLocale();
  const db = await userClient();
  const [team, members, t] = await Promise.all([
    journalAbout(kind, externalId, locale),
    db
      ? postsAbout(db, `${kind}:${externalId}`, SHOWN).catch((error: unknown) => {
          console.error(error);
          return [];
        })
      : [],
    getTranslations("Journal"),
  ]);
  const articles = [
    ...team.map((a) => ({ slug: a.slug, title: a.meta.title, locale: a.locale, at: `${a.meta.date}T23:59:59.999Z` })),
    ...members.map((p) => ({ slug: p.id, title: p.title, locale: p.locale, at: p.publishedAt ?? p.updatedAt })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, SHOWN);

  return (
    <section aria-labelledby="title-journal" className="flex flex-col gap-2">
      <h2 id="title-journal" className="font-display text-lg font-bold">
        {t("about")}
      </h2>
      {articles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <li key={a.slug} lang={a.locale === locale ? undefined : a.locale}>
              <Link href={articlePath(a.slug)} className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border hover:ring-brand/50">
                <NotebookPenIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="font-semibold">{a.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={{ pathname: "/journal/write", query: { about: `${kind}:${externalId}` } }}
        className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand underline underline-offset-4"
      >
        <PenLineIcon className="size-4" aria-hidden="true" />
        {t("writeAbout")}
      </Link>
    </section>
  );
}
