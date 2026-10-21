"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArticleRow } from "@/components/journal/article-row";
import { articleFeedTime, interleaveArticles, type FeedArticle, type FeedSlot } from "@/core/journal-feed";
import { mergeByTime, type FeedCursor, type FeedItem, type FeedRanking } from "@/core/social";
import { FeedEntry } from "./feed-entry";
import { FeedRankingPost } from "./feed-ranking";

type Slot = FeedSlot<FeedItem, FeedArticle> | { type: "ranking"; ranking: FeedRanking };

const slotTime = (slot: Slot) =>
  slot.type === "entry" ? Date.parse(slot.item.finishedAt) : slot.type === "article" ? articleFeedTime(slot.article) : Date.parse(slot.ranking.sharedAt);

/**
 * The Following feed: the first page comes from the server, "Load more" fetches the next ones (GET /api/feed). A club
 * page passes its items with no `next`, and `readOnly` for signed-out visitors. `articles`, the Journal's newest, and
 * `rankings`, the newest shared by the people followed (ADR 0099), go in by their date as the pages load (ADR 0052).
 */
export function FeedList({
  items: first,
  next: firstNext,
  now,
  readOnly = false,
  articles = [],
  rankings = [],
}: {
  items: FeedItem[];
  next: FeedCursor | null;
  now: number;
  readOnly?: boolean;
  articles?: FeedArticle[];
  rankings?: FeedRanking[];
}) {
  const t = useTranslations("Social");
  const [items, setItems] = useState(first);
  const [next, setNext] = useState(firstNext);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!next) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/feed?${new URLSearchParams({ before: next.before, id: next.id })}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { items: FeedItem[]; next: FeedCursor | null };
      setItems((cur) => [...cur, ...page.items.filter((i) => !cur.some((c) => c.entryId === i.entryId))]);
      setNext(page.next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="stagger flex flex-col gap-6">
        {mergeByTime<Slot>(
          interleaveArticles(items, articles, next === null),
          rankings.map((ranking) => ({ type: "ranking", ranking })),
          slotTime,
          next === null,
        ).map((slot, i) =>
          slot.type === "entry" ? (
            <li key={slot.item.entryId}>
              <FeedEntry item={slot.item} now={now} index={i} readOnly={readOnly} />
            </li>
          ) : slot.type === "ranking" ? (
            <li key={`ranking-${slot.ranking.cardId}`}>
              <FeedRankingPost ranking={slot.ranking} now={now} index={i} />
            </li>
          ) : (
            <li key={`journal-${slot.article.slug}`}>
              <ArticleRow article={slot.article} place="feed" now={now} index={i} card />
            </li>
          ),
        )}
      </ul>
      {next && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="h-12 self-center rounded-full px-6 font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-60 press"
        >
          {loading ? t("loading") : t("loadMore")}
        </button>
      )}
      <p aria-live="polite" className="text-center text-sm text-destructive empty:hidden">
        {failed ? t("problem", { problem: "error" }) : ""}
      </p>
    </div>
  );
}
