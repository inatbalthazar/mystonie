import { PenLineIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FreshPage } from "@/components/motion/fresh-page";
import { SwipeArea } from "@/components/motion/swipe-area";
import { localizedPath } from "@/core/auth";
import { articlePath } from "@/core/journal-feed";
import type { PostState } from "@/core/journal-posts";
import { myPosts } from "@/data/journal-posts";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/me/journal">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: `${t("tabJournal")} · Mystonie`, robots: { index: false, follow: false } };
}

const STATE_STYLE: Record<PostState, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-card ring-1 ring-border",
  pending: "bg-brand-soft text-brand",
  featured: "border-2 border-double border-brand/70 text-brand -rotate-3",
  declined: "bg-muted text-muted-foreground",
  hidden: "bg-destructive/10 text-destructive",
};

/**
 * Me's Journal tab (ADR 0092): the articles you wrote, drafts too, last edited first, each with where it stands
 * (draft, waiting for the team, Featured…), the team's note when there's one, and Write on top. Under Me's cover and
 * tabs (ADR 0081).
 */
export default async function MyJournalPage({ params }: PageProps<"/[locale]/me/journal">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/me/journal", locale, routing.defaultLocale);
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [posts, t, tp, format] = await Promise.all([myPosts(db, userId), getTranslations("Journal"), getTranslations("Profile"), getFormatter()]);

  return (
    <>
      <FreshPage />
      <SwipeArea prev="/me/cards" className="flex flex-col gap-6">
        <Link
          href="/journal/write"
          className="flex h-12 items-center gap-2 self-start rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
        >
          <PenLineIcon className="size-5" aria-hidden="true" />
          {posts.length ? t("writeLabel") : tp("writeFirst")}
        </Link>
        {posts.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center font-hand text-2xl text-muted-foreground">{tp("meJournalEmpty")}</p>
        ) : (
          <ol className="stagger flex flex-col divide-y-2 divide-dashed divide-border">
            {posts.map((p) => (
              <li key={p.id} className="relative flex flex-col gap-1.5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 font-display text-xs font-extrabold", STATE_STYLE[p.state])}>{t("state", { state: p.state })}</span>
                  <time dateTime={p.updatedAt} className="text-xs text-muted-foreground">
                    {format.relativeTime(new Date(p.updatedAt))}
                  </time>
                </div>
                <h2 className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] break-words">
                  <Link
                    href={p.state === "draft" ? { pathname: "/journal/write", query: { id: p.id } } : articlePath(p.id)}
                    className="outline-none after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {p.title}
                  </Link>
                </h2>
                {p.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>}
                {p.reviewNote && <p className="font-hand text-lg leading-tight text-brand">{t("reviewNote", { note: p.reviewNote })}</p>}
                {p.state !== "draft" && (
                  <Link
                    href={{ pathname: "/journal/write", query: { id: p.id } }}
                    className="relative z-10 flex min-h-11 items-center self-start text-sm font-semibold text-brand underline underline-offset-4"
                  >
                    {t("edit")}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </SwipeArea>
    </>
  );
}
