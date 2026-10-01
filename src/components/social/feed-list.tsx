"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArticleRow } from "@/components/journal/article-row";
import { interleaveArticles, type FeedArticle } from "@/core/journal-feed";
import type { FeedCursor, FeedItem } from "@/core/social";
import { FeedEntry } from "./feed-entry";

/**
 * The Following feed: the first page comes from the server, "Load more" fetches the next ones (GET /api/feed). A club
 * page passes its items with no `next`, and `readOnly` for signed-out visitors. `articles`, the Journal's newest, go
 * in by their date as the pages load (ADR 0052).
 */
export function FeedList({
  items: first,
  next: firstNext,
  now,
  readOnly = false,
  articles = [],
}: {
  items: FeedItem[];
  next: FeedCursor | null;
  now: number;
  readOnly?: boolean;
  articles?: FeedArticle[];
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
      <ul className="flex flex-col gap-6">
        {interleaveArticles(items, articles, next === null).map((slot, i) =>
          slot.type === "entry" ? (
            <li key={slot.item.entryId}>
              <FeedEntry item={slot.item} now={now} index={i} readOnly={readOnly} />
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
          className="h-12 self-center rounded-2xl px-6 font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-60"
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
