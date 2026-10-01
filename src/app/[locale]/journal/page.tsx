import type { Locale } from "next-intl";
import { feedTabForJournal } from "@/core/journal-feed";
import { permanentRedirect } from "@/i18n/navigation";

/**
 * The Journal's list lives in the feed now (ADR 0062): `/journal` sends old links and search engines there for good,
 * Saved to Saved and the other tabs to the articles. The articles themselves stay at `/journal/<slug>`.
 */
export default async function JournalPage({ params, searchParams }: PageProps<"/[locale]/journal">) {
  const locale = (await params).locale as Locale;
  const tab = feedTabForJournal((await searchParams).tab);
  return permanentRedirect({ href: { pathname: "/feed", query: { tab } }, locale });
}
