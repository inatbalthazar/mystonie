import { TrophyIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PaperCard } from "@/components/paper-card";
import { BoardList } from "@/components/social/board-list";
import { localizedPath } from "@/core/auth";
import { BOARD_PERIODS, isBoardPeriod, type BoardPeriod } from "@/core/board";
import { addDays } from "@/core/stats/recap";
import { friendBoard } from "@/data/board";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Board");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** The period's last local day: the Sunday after a Monday, or the month's last day. */
function lastDay(start: string, period: BoardPeriod): string {
  if (period === "week") return addDays(start, 6);
  const [y, m] = start.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

/**
 * The board (S3 finishers & the board): you and the people you follow, ranked by this week's (or month's) time spent
 * watching and reading, then titles finished. Private and blocked profiles never show (RLS).
 */
export default async function BoardPage({ params, searchParams }: PageProps<"/[locale]/board">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const period: BoardPeriod = isBoardPeriod(query.period) ? query.period : "week";
  const self = localizedPath(period === "week" ? "/board" : `/board?period=${period}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, t, format] = await Promise.all([
    supabase.from("profiles").select("username, display_name, avatar_url, time_zone").eq("id", userId).single(),
    getTranslations("Board"),
    getFormatter(),
  ]);
  const timeZone = profile?.time_zone ?? "UTC";
  const viewer = { id: userId, username: profile?.username ?? "", displayName: profile?.display_name ?? null, avatarUrl: profile?.avatar_url ?? null };
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const board = await friendBoard(supabase, viewer, period, timeZone, Date.now());
  const day = (key: string) => new Date(`${key}T00:00:00Z`);
  const range = format.dateTimeRange(day(board.start), day(lastDay(board.start, period)), { month: "short", day: "numeric", timeZone: "UTC" });
  const ranked = board.rows.filter((r) => r.rank !== null).length;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-hand text-2xl leading-none text-muted-foreground">{t("kicker")}</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        </div>
      </header>

      <nav aria-label={t("periodLabel")} className="flex gap-1 self-start rounded-full bg-muted p-1">
        {BOARD_PERIODS.map((p) => (
          <Link
            key={p}
            href={p === "week" ? "/board" : { pathname: "/board", query: { period: p } }}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
              p === period ? "bg-card text-foreground shadow-sm ring-1 ring-brand/60" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("period", { period: p })}
          </Link>
        ))}
      </nav>

      <PaperCard className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            <TrophyIcon className="size-5 text-brand" aria-hidden="true" />
            {t("boardTitle", { period })}
          </h2>
          <p className="font-hand text-lg leading-tight text-muted-foreground">{range}</p>
        </div>
        <BoardList rows={board.rows} />
        {ranked === 0 && <p className="font-hand text-xl text-muted-foreground">{t("quiet", { period })}</p>}
      </PaperCard>

      {board.following === 0 && (
        <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
          <p className="font-hand text-2xl text-muted-foreground">{t("empty")}</p>
          <Link
            href="/people"
            className="flex h-12 items-center gap-2 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            <UsersIcon className="size-5" aria-hidden="true" />
            {t("findPeople")}
          </Link>
        </section>
      )}

      <p className="text-sm text-muted-foreground">{t("hint", { period })}</p>
    </main>
  );
}
