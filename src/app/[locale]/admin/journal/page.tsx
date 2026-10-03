import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArticleBlocks } from "@/components/journal/article-blocks";
import { ReviewActions } from "@/components/journal/review-actions";
import { parseWriterBody } from "@/core/journal";
import { articlePath } from "@/core/journal-feed";
import { teamMember } from "@/data/admin";
import { reviewQueue, type QueuedPost } from "@/data/journal-posts";
import { adminClient } from "@/data/supabase-admin";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("JournalAdmin");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * The team's review of members' Journal articles (stage 4, ADR 0092): the ones sent to be Featured, oldest first, and
 * the reported ones, each with its text to read in place and the team's buttons. Only for an account signed in with
 * an `ADMIN_EMAILS` address; anyone else gets a 404.
 */
export default async function JournalReviewPage({ params }: PageProps<"/[locale]/admin/journal">) {
  setRequestLocale((await params).locale as Locale);
  const admin = adminClient();
  if (!(await teamMember()) || !admin) notFound();
  const [{ pending, reported }, t, tj] = await Promise.all([reviewQueue(admin), getTranslations("JournalAdmin"), getTranslations("Journal")]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      {[
        { key: "pending", title: t("pending"), posts: pending, actions: ["approve", "decline", "hide"] as const },
        { key: "reported", title: t("reported"), posts: reported, actions: ["hide", "unhide"] as const },
      ].map((section) => (
        <section key={section.key} aria-labelledby={`review-${section.key}`} className="flex flex-col gap-4">
          <h2 id={`review-${section.key}`} className="font-display text-2xl font-extrabold">
            {section.title}
            <span className="ml-2 text-base text-muted-foreground">{section.posts.length}</span>
          </h2>
          {section.posts.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-5 text-center text-muted-foreground">{t("nothing")}</p>
          ) : (
            section.posts.map((post) => <Queued key={post.id} post={post} actions={section.actions} tagName={(tag) => tj("tag", { tag })} />)
          )}
        </section>
      ))}
    </main>
  );
}

async function Queued({ post, actions, tagName }: { post: QueuedPost; actions: readonly ("approve" | "decline" | "hide" | "unhide")[]; tagName: (tag: string) => string }) {
  const [t, tj, format] = await Promise.all([getTranslations("JournalAdmin"), getTranslations("Journal"), getFormatter()]);
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl leading-tight font-extrabold break-words">{post.title}</h3>
        <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
          {post.byline && (
            <Link href={`/u/${post.byline.username}`} className="font-semibold text-foreground underline underline-offset-2">
              {t("by", { username: post.byline.username })}
            </Link>
          )}
          <span>{format.relativeTime(new Date(post.updatedAt))}</span>
          <span>{post.tags.map(tagName).join(" · ")}</span>
          {post.hiddenAt && <span className="font-semibold text-destructive">{tj("state", { state: "hidden" })}</span>}
        </p>
        {post.description && <p className="text-muted-foreground">{post.description}</p>}
      </div>
      {post.reports.length > 0 && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm">
          <p className="font-semibold">{t("reports", { count: post.reports.length })}</p>
          <ul className="list-disc pl-5">
            {post.reports.map((r, i) => (
              <li key={i}>{t("report", { reason: r.reason, note: r.note ?? "" })}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="rounded-xl bg-muted/50 p-3">
        <summary className="cursor-pointer font-semibold">{t("read")}</summary>
        <div className="mt-3">
          <ArticleBlocks blocks={parseWriterBody(post.body)} />
        </div>
        <Link href={articlePath(post.id)} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">
          {post.title}
        </Link>
      </details>
      <ReviewActions id={post.id} actions={actions} />
    </article>
  );
}
