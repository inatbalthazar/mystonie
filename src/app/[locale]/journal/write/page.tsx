import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PostEditor, type EditorPost, type EditorSubject } from "@/components/journal/post-editor";
import { localizedPath } from "@/core/auth";
import { countryName, countryOptions } from "@/core/countries";
import { isUuidV7 } from "@/core/ids";
import { parseSubject, subjectKey, type JournalSubject } from "@/core/journal-posts";
import { readPost, subjectCards } from "@/data/journal-posts";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("JournalWrite");
  return { title: `${t("newTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Writing a Journal article (stage 4, ADR 0092): `?id=` edits one of yours, `?about=movie:603` starts one about a
 * title or place (a title page's "Write about it").
 */
export default async function WritePage({ params, searchParams }: PageProps<"/[locale]/journal/write">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const self = localizedPath("/journal/write", locale, routing.defaultLocale);
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const id = typeof query.id === "string" && isUuidV7(query.id.toLowerCase()) ? query.id.toLowerCase() : null;
  const [post, { data: profile }, t] = await Promise.all([
    id ? readPost(db, id) : null,
    db.from("profiles").select("visibility").eq("id", userId).single(),
    getTranslations("JournalWrite"),
  ]);
  // Someone else's (or a deleted) article: start a new one instead.
  const own = post && post.userId === userId ? post : null;
  if (id && !own) return redirect({ href: "/journal/write", locale });

  const about = typeof query.about === "string" ? parseSubject(query.about) : null;
  const subjects: JournalSubject[] = own ? own.subjects : about ? [about] : [];
  const cards = await subjectCards(db, subjects, locale);
  const editorSubjects: EditorSubject[] = cards.map((c) =>
    c.kind === "place"
      ? { key: `place:${c.country}`, name: c.name, posterUrl: null, country: c.country }
      : { key: subjectKey({ kind: c.kind, externalId: c.externalId }), name: c.name, posterUrl: c.posterUrl, country: null },
  );

  const initial: EditorPost = own
    ? {
        id: own.id,
        locale: own.locale,
        title: own.title,
        description: own.description ?? "",
        body: own.body,
        tags: own.tags,
        subjects: editorSubjects,
        spoilers: own.spoilers,
        feature: own.featureRequest !== null,
        state: own.state,
      }
    : { id: null, locale, title: "", description: "", body: "", tags: [], subjects: editorSubjects, spoilers: false, feature: false, state: null };
  const languages = routing.locales.map((code) => ({ code, name: new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code }));
  const countries = countryOptions(locale).map(([code, name]) => [code, name, countryName(code, "en")] as const);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">{t("kicker")}</p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{own ? t("editTitle") : t("newTitle")}</h1>
      </header>
      <PostEditor key={own?.id ?? "new"} initial={initial} locales={languages} countries={countries} privatePage={profile?.visibility !== "public"} />
    </main>
  );
}
