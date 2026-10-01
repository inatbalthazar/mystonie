import { getTranslations } from "next-intl/server";
import { titleReviews } from "@/data/social";
import type { UserClient } from "@/data/supabase-server";
import { PaperCard } from "../paper-card";
import { ReviewList } from "./review-list";

/**
 * "What people said" on a title page (ADR 0051): the short reviews written when finishing it, by you and by public,
 * unblocked people, newest first, each with its rating and Stamp. Nothing shows until someone has written one.
 * Rendered inside Suspense.
 */
export async function TitleReviews({ supabase, userId, titleId }: { supabase: UserClient; userId: string; titleId: string }) {
  const [items, t] = await Promise.all([
    titleReviews(supabase, userId, titleId).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    getTranslations("Finishers"),
  ]);
  if (items.length === 0) return null;
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  return (
    <PaperCard className="flex flex-col gap-4 pt-6" labelledBy="title-reviews">
      <h2 id="title-reviews" className="font-display text-lg font-bold">
        {t("reviews")}
      </h2>
      <ReviewList items={items} now={now} />
    </PaperCard>
  );
}
