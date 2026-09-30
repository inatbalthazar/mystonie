import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReviewBookends, ReviewCover, ReviewEmpty, ReviewMilestones, ReviewMonths, ReviewNumbers, ReviewTop } from "@/components/review/review-view";
import { ShareYear } from "@/components/review/share-year";
import { Records, Taste } from "@/components/stats/stats-view";
import { localizedPath } from "@/core/auth";
import { weekStartFor } from "@/core/stats/period";
import { isReviewYear, yearInReview } from "@/core/stats/year-review";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/review/[year]">): Promise<Metadata> {
  const { year } = await params;
  const t = await getTranslations("Review");
  return { title: `${t("pageTitle", { year })} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Year in Review (S2 milestones & recaps, ADR 0031): the signed-in user's year as album pages, from the cover to
 * the year's milestones, with "Share my year" for the Yearbook card. The current year reads "so far"; Home points
 * here in December and January.
 */
export default async function ReviewPage({ params }: PageProps<"/[locale]/review/[year]">) {
  const { locale: raw, year: yearParam } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const self = localizedPath(`/review/${yearParam}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, rows, t] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    statsRows(supabase, userId),
    getTranslations("Review"),
  ]);
  const timeZone = profile?.time_zone ?? "UTC";
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : NaN;
  if (!isReviewYear(year, now, timeZone)) notFound();

  const review = yearInReview(rows.titles, rows.entries, rows.logs, rows.reads, { year, timeZone, weekStart: weekStartFor(locale), now });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10 pb-28">
      <h1 className="sr-only">{t("pageTitle", { year })}</h1>
      {!review.card ? (
        <ReviewEmpty year={year} />
      ) : (
        <>
          <ReviewCover review={review}>
            <div className="flex flex-col gap-1">
              <ShareYear card={review.card} username={profile?.username ?? null} host={siteUrl().host} />
              <p className="text-sm text-muted-foreground">{t("shareHint")}</p>
            </div>
          </ReviewCover>
          <ReviewNumbers review={review} />
          <ReviewTop review={review} />
          <ReviewMonths review={review} />
          <Taste report={review.report} />
          <Records report={review.report} />
          <ReviewBookends review={review} />
          <ReviewMilestones review={review} />
        </>
      )}
    </main>
  );
}
