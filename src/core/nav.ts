// The nav island (ADR 0050, ADR 0053): which tab a page belongs to. Paths come without the locale prefix.

export const NAV_TABS = ["home", "collection", "feed", "me"] as const;
export type NavTab = (typeof NAV_TABS)[number];

/** Each tab's page, and the pages under it that keep it lit. The ➕ between Collection and Feed is an action, never lit. */
export const NAV_TAB_PATHS: Record<NavTab, { href: `/${string}`; within: readonly string[] }> = {
  // Home and the community pages it leads to (ADR 0078).
  home: { href: "/home", within: ["/home", "/people", "/board", "/challenges", "/clubs", "/reel"] },
  // The collection's Watch · Read · Play, and its Atlas tab (`/collection/atlas`, ADR 0059).
  collection: { href: "/collection", within: ["/collection"] },
  // The feed and the Journal's articles, which it lists (ADR 0062).
  feed: { href: "/feed", within: ["/feed", "/journal"] },
  // Your page: its Stats tab (and Year in Review, the stats of a whole year), and the settings you open from it.
  me: { href: "/me", within: ["/me", "/stats", "/review", "/settings"] },
};

/** The tab to light for a page, or null for pages outside the four (a title, someone else's profile, a card). */
export function navTab(path: string): NavTab | null {
  const clean = path.replace(/\/+$/, "") || "/";
  for (const tab of NAV_TABS) {
    if (NAV_TAB_PATHS[tab].within.some((p) => clean === p || clean.startsWith(`${p}/`))) return tab;
  }
  return null;
}
