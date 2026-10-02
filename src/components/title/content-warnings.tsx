import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { avoidHits, DTDD_URL, warningVerdict, type TopicVotes, type WarningVerdict } from "@/core/catalog/dtdd";
import type { TmdbKind } from "@/core/catalog/tmdb";
import type { Title } from "@/core/catalog/types";
import { dtddTopics } from "@/data/dtdd";
import { titleWarnings } from "@/data/warnings";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PaperCard } from "../paper-card";

type Props = {
  titleId: string;
  title: Title & { kind: TmdbKind };
  /** The signed-in user's avoid-topics (DTDD topic ids). */
  avoid: number[];
  /** This page's path (`/title/movie/245891`), for "show this title's warnings" without topics chosen. */
  path: string;
  /** `?warnings=1`: look the title up even though no topics are chosen. */
  check: boolean;
};

const VERDICT_STYLE: Record<WarningVerdict, string> = {
  yes: "bg-brand text-brand-foreground",
  no: "bg-muted text-muted-foreground ring-1 ring-border",
  unclear: "bg-card text-foreground ring-1 ring-border",
};

const VERDICT_ORDER: WarningVerdict[] = ["yes", "unclear", "no"];

function Frame({ children, stamp }: { children: ReactNode; stamp?: string }) {
  return (
    <PaperCard id="content-warnings" stamp={stamp} className="flex flex-col gap-4 pt-6">
      {children}
    </PaperCard>
  );
}

const linkClass = "font-semibold text-brand underline-offset-2 hover:underline";

/**
 * S2 content warnings: DoesTheDogDie's community votes for the user's avoid-topics (Yes / No / Unclear with the
 * counts), every other topic collapsed under "See all topics", spoilers and comments behind a tap, and DTDD's
 * credit. Rendered inside Suspense: a DTDD lookup never holds up the page.
 */
export async function ContentWarnings({ titleId, title, avoid, path, check }: Props) {
  const [t, format] = await Promise.all([getTranslations("Warnings"), getFormatter()]);
  const heading = <h2 className="font-display text-lg font-bold">{t("title")}</h2>;

  if (avoid.length === 0 && !check) {
    return (
      <Frame>
        {heading}
        <p className="text-sm text-muted-foreground">{t("setupBody")}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/settings/warnings" className="inline-flex h-11 items-center rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press">
            {t("setupLink")}
          </Link>
          <Link href={{ pathname: path, query: { warnings: "1" } }} scroll={false} className={cn(linkClass, "text-sm")}>
            {t("checkAnyway")}
          </Link>
        </div>
      </Frame>
    );
  }

  const result = await titleWarnings(titleId, title);
  const editLink = (
    <Link href="/settings/warnings" className={cn(linkClass, "text-sm")}>
      {avoid.length > 0 ? t("editTopics") : t("setupLink")}
    </Link>
  );
  if (!result || result.status === "unmatched") {
    return (
      <Frame>
        {heading}
        <p className="text-sm text-muted-foreground">{result ? t("none") : t("error")}</p>
        {editLink}
      </Frame>
    );
  }

  const hits = avoidHits(result.topics, avoid);
  const byId = new Map(result.topics.map((topic) => [topic.id, topic]));
  // Avoid-topics nobody voted on for this title still get a row ("No votes yet"), named from DTDD's topic list.
  const missing = avoid.filter((id) => !byId.has(id));
  const names = missing.length > 0 ? new Map((await dtddTopics().catch(() => [])).map((topic) => [topic.id, topic.name])) : new Map<number, string>();
  const mine = avoid
    .map((id) => ({ id, name: byId.get(id)?.name ?? names.get(id), votes: byId.get(id) }))
    .filter((row): row is { id: number; name: string; votes: TopicVotes | undefined } => !!row.name);
  const others = result.topics
    .filter((topic) => !avoid.includes(topic.id))
    .sort((a, b) => b.yes - a.yes || a.name.localeCompare(b.name, "en"));
  const votes = (topic: TopicVotes) => t("votes", { yes: format.number(topic.yes), no: format.number(topic.no) });

  const verdictPill = (verdict: WarningVerdict) => (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase", VERDICT_STYLE[verdict])}>
      {t("verdict", { verdict })}
    </span>
  );

  /** The verdict and counts, behind a tap when DTDD marks the topic as a spoiler. */
  const answer = (topic: TopicVotes) => {
    const shown = (
      <span className="flex flex-wrap items-center gap-2">
        {verdictPill(warningVerdict(topic.yes, topic.no))}
        <span className="text-xs text-muted-foreground tabular-nums">{votes(topic)}</span>
      </span>
    );
    if (!topic.spoiler) return shown;
    return (
      <details className="group/spoiler">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground underline decoration-dashed underline-offset-2 group-open/spoiler:hidden">
          {t("spoiler")}
        </summary>
        {shown}
      </details>
    );
  };

  return (
    <Frame stamp={hits.length > 0 ? t("headsUp") : undefined}>
      {heading}
      {hits.length > 0 && (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-semibold text-foreground ring-1 ring-brand/20">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          {t("badge", { topics: format.list(hits.map((h) => h.name), { type: "conjunction" }) })}
        </p>
      )}

      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("yourTopics")}</h3>
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {mine.map(({ id, name, votes: topic }) => (
              <li key={id} className="flex flex-col gap-1.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium first-letter:uppercase">{name}</span>
                  {topic ? answer(topic) : <span className="text-xs text-muted-foreground">{t("noVotes")}</span>}
                </div>
                {topic?.comment && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t("showComment")}</summary>
                    <blockquote className="mt-1.5 border-l-2 border-brand/40 pl-3 text-muted-foreground">{topic.comment}</blockquote>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {others.length > 0 && (
        <details className="group rounded-xl ring-1 ring-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">{t("seeAll", { count: format.number(others.length) })}</summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {VERDICT_ORDER.map((verdict) => {
              const group = others.filter((topic) => warningVerdict(topic.yes, topic.no) === verdict);
              if (group.length === 0) return null;
              return (
                <div key={verdict} className="flex flex-col gap-1">
                  <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("group", { verdict })}</h3>
                  <ul className="flex flex-col">
                    {group.map((topic) => (
                      <li key={topic.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
                        <span className="first-letter:uppercase">{topic.name}</span>
                        {topic.spoiler ? answer(topic) : <span className="text-xs text-muted-foreground tabular-nums">{votes(topic)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-muted-foreground">
          {t.rich("attribution", {
            link: (chunks) => (
              <a href={DTDD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
                {chunks}
              </a>
            ),
          })}
          {" · "}
          <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {t("details")}
          </a>
        </p>
        {editLink}
      </div>
    </Frame>
  );
}

/** The block while DTDD answers. */
export async function ContentWarningsSkeleton() {
  const t = await getTranslations("Warnings");
  return (
    <PaperCard className="flex flex-col gap-4 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <span key={i} className="h-5 w-3/4 skeleton rounded-md" />
        ))}
      </div>
    </PaperCard>
  );
}
