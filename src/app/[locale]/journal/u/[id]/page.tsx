import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { ArticleActionsBar } from "@/components/journal/article-actions-bar";
import { ArticleBlocks } from "@/components/journal/article-blocks";
import { languageName } from "@/components/journal/article-meta";
import { Byline } from "@/components/journal/byline";
import { SpoilerGate } from "@/components/journal/spoiler-gate";
import { SubjectStrip } from "@/components/journal/subject-strip";
import { ReportButton } from "@/components/report-button";
import { localizedPath } from "@/core/auth";
import { isUuidV7 } from "@/core/ids";
import { parseWriterBody } from "@/core/journal";
import { bylines, readPost, subjectCards, type Byline as Writer } from "@/data/journal-posts";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/** The article and who's reading it, once per request (metadata and page). */
const load = cache(async (raw: string) => {
  const id = raw.toLowerCase();
  if (!isUuidV7(id)) return null;
  const db = await userClient();
  if (!db) return null;
  const [{ data }, post] = await Promise.all([db.auth.getClaims(), readPost(db, id)]);
  if (!post) return null;
  const viewerId = data?.claims.sub ?? null;
  const owner = viewerId === post.userId;
  // The writer's byline: public, unblocked writers through journal_bylines; the writer themselves from their profile.
  let writer: Writer | null = (await bylines(db, [post.userId]).catch(() => new Map<string, Writer>())).get(post.userId) ?? null;
  let privatePage = false;
  if (owner) {
    const { data: me } = await db.from("profiles").select("id, username, display_name, avatar_url, visibility").eq("id", post.userId).single();
    if (me) {
      writer = { id: me.id, username: me.username, displayName: me.display_name, avatarUrl: me.avatar_url };
      privatePage = me.visibility !== "public";
    }
  }
  return { db, post, owner, writer, privatePage };
});

export async function generateMetadata({ params }: PageProps<"/[locale]/journal/u/[id]">): Promise<Metadata> {
  const loaded = await load((await params).id);
  if (!loaded) return { robots: { index: false } };
  const { post } = loaded;
  const featured = post.state === "featured";
  return {
    title: `${post.title} · Mystonie`,
    description: post.summary ?? undefined,
    alternates: { canonical: `/journal/u/${post.id}` },
    openGraph: { type: "article", title: post.title, description: post.summary ?? undefined, publishedTime: post.publishedAt ?? undefined },
    // Featured articles are the Journal's; the rest are members' pages and stay out of search engines (ADR 0092).
    ...(featured ? {} : { robots: { index: false, follow: false } }),
  };
}

/**
 * A member's Journal article (stage 4, ADR 0092): title, line, byline, date and categories, what it's about with
 * Check, the text (behind a warning when it has spoilers), then Stamp, Save, Share and Report. Its writer also sees
 * where it stands (draft, waiting for the team, Featured…) with Edit.
 */
export default async function MemberArticlePage({ params }: PageProps<"/[locale]/journal/u/[id]">) {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const loaded = await load(id);
  if (!loaded) notFound();
  const { db, post, owner, writer, privatePage } = loaded;
  const [t, format, subjects] = await Promise.all([getTranslations("Journal"), getFormatter(), subjectCards(db, post.subjects, locale)]);
  const blocks = parseWriterBody(post.body);
  const written = post.locale !== locale ? post.locale : null;
  const day = post.publishedAt ?? post.updatedAt;
  const path = `/journal/u/${post.id}`;
  const body = <ArticleBlocks blocks={blocks} />;
  const jsonLd =
    post.state === "featured" && writer
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.summary ?? undefined,
          datePublished: post.publishedAt,
          inLanguage: post.locale,
          author: { "@type": "Person", name: writer.displayName ?? writer.username, url: new URL(`/u/${writer.username}`, siteUrl()).href },
          publisher: { "@type": "Organization", name: "Mystonie" },
        }).replace(/</g, "\\u003c")
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      {owner && (
        <section aria-label={t("yourArticle")} className="flex flex-col gap-2 rounded-2xl bg-brand-soft/60 p-4 dark:bg-brand/10">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-extrabold">{t("state", { state: post.state })}</p>
            <Link
              href={{ pathname: "/journal/write", query: { id: post.id } }}
              className="flex h-10 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-bold shadow-sm ring-1 ring-border press"
            >
              <PencilIcon className="size-4" aria-hidden="true" />
              {t("edit")}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t("stateHelp", { state: post.state })}</p>
          {post.reviewNote && <p className="font-hand text-xl leading-tight text-brand">{t("reviewNote", { note: post.reviewNote })}</p>}
          {privatePage && post.publishedAt && <p className="text-sm">{t("privatePage")}</p>}
        </section>
      )}
      {written && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("inLanguage", { language: await languageName(written) })}</p>}
      <article lang={written ?? undefined} className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          {(post.tags.length > 0 || post.state === "featured") && (
            <p className="flex flex-wrap items-center gap-2">
              {post.state === "featured" && (
                <span className="-rotate-3 rounded-full border-2 border-double border-brand/70 px-2 py-0.5 font-display text-[11px] font-extrabold tracking-[0.1em] text-brand uppercase [&:lang(th)]:tracking-normal">
                  {t("featured")}
                </span>
              )}
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={{ pathname: "/feed", query: { tab: "articles", tag } }}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-bold hover:bg-brand-soft hover:text-brand"
                >
                  {t("tag", { tag })}
                </Link>
              ))}
            </p>
          )}
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance break-words">{post.title}</h1>
          {post.description && <p className="text-lg text-muted-foreground">{post.description}</p>}
          <div className="flex flex-col gap-2">
            {writer && <Byline author={writer.displayName ?? writer.username} avatar={writer.avatarUrl} profile={writer.username} page className="self-start" />}
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <time dateTime={day}>{format.dateTime(new Date(day), { dateStyle: "long" })}</time>
              <span aria-hidden="true">·</span>
              <span>{t("readTime", { minutes: post.minutes })}</span>
              {post.spoilers && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("spoilers")}</span>}
            </span>
          </div>
        </header>
        <SubjectStrip subjects={subjects} />
        {post.spoilers && !owner ? <SpoilerGate>{body}</SpoilerGate> : body}
      </article>
      {post.state !== "draft" && post.state !== "hidden" && !privatePage && (
        <ArticleActionsBar slug={post.id} title={post.title} next={localizedPath(path, locale, routing.defaultLocale)} />
      )}
      {!owner && <ReportButton targetKind="article" targetId={post.id} className="self-start" />}
    </main>
  );
}
