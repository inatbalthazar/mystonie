"use client";

import { CircleUserRoundIcon, HouseIcon, LibraryBigIcon, PlusIcon, UsersRoundIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { NAV_TAB_PATHS, navTab, type NavTab } from "@/core/nav";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useFeedNews } from "./social/feed-news";

/**
 * Sent on `window` by the island's ➕ (cancelable). A page that opens quick add in place (the collection) cancels it
 * and the ➕ stays on the page; anywhere else it goes to /collection?add=1.
 */
export const QUICK_ADD_EVENT = "mystonie:quick-add";

// A ➕ tapped on the collection before its page was ready (hydrated): it opens quick add once it is. Going to
// ?add=1 instead would land late and remount the page over whatever the second tap had opened.
const PENDING_MS = 10_000;
let pendingAddAt = 0;

/** True once for a ➕ tapped on the collection in the last 10 seconds, before the page could take it. */
export function takePendingQuickAdd(): boolean {
  const pending = Date.now() - pendingAddAt < PENDING_MS;
  pendingAddAt = 0;
  return pending;
}

const ICONS: Record<NavTab, LucideIcon> = {
  home: HouseIcon,
  collection: LibraryBigIcon,
  feed: UsersRoundIcon,
  me: CircleUserRoundIcon,
};

/**
 * The nav island (ADR 0050): the app's main navigation, a paper pill taped over the bottom of the page within thumb
 * reach, Home · Collection · ➕ · Feed · Me (Stats is a tab of Me, ADR 0053). In every page's HTML and shown by CSS
 * once signed in (`signed-in:`), so public pages stay static and it's there from the first paint. Icons only on
 * phones (the names are for screen readers), names under them from 640px. The coral ➕ is quick add, one tap from
 * anywhere. A coral dot on Feed says something about you happened since you last opened it (ADR 0054).
 */
export function NavIsland() {
  const t = useTranslations("Account");
  const current = navTab(usePathname());
  const feedNews = useFeedNews() && current !== "feed";

  function add(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; // a new tab
    const taken = !window.dispatchEvent(new Event(QUICK_ADD_EVENT, { cancelable: true }));
    if (!taken && current !== "collection") return; // off to /collection?add=1
    event.preventDefault();
    if (!taken) pendingAddAt = Date.now();
  }

  function tab(id: NavTab) {
    const Icon = ICONS[id];
    const active = current === id;
    const dot = id === "feed" && feedNews;
    return (
      <Link
        href={NAV_TAB_PATHS[id].href}
        aria-current={active ? "page" : undefined}
        aria-label={dot ? t("feedNews") : undefined}
        className={cn(
          "relative flex size-12 flex-col items-center justify-center gap-0.5 rounded-full transition-[color,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 sm:h-14 sm:w-20",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="relative">
          <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
          {/* Something new about you: a coral dot, no count. */}
          {dot && <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-brand ring-2 ring-card dark:ring-muted" />}
        </span>
        <span className="sr-only text-[11px] leading-none font-semibold sm:not-sr-only">{t(id)}</span>
        {/* The lit tab: a strip of coral tape under it. */}
        {active && <span aria-hidden="true" className="absolute bottom-0.5 h-[3px] w-4 rounded-full bg-brand sm:bottom-0" />}
      </Link>
    );
  }

  return (
    <div
      data-nav-island
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden justify-center bg-gradient-to-t from-background/85 via-background/40 to-transparent px-4 pt-5 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] signed-in:flex print:hidden"
    >
      <nav
        aria-label={t("nav")}
        className="pointer-events-auto relative w-full max-w-[22rem] rounded-full bg-card/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_3px_rgb(0_0_0/0.06),0_14px_34px_-14px_rgb(0_0_0/0.45)] ring-1 ring-border sm:max-w-md dark:bg-muted/80 dark:shadow-[0_14px_34px_-10px_rgb(0_0_0/0.8)] dark:ring-foreground/15"
      >
        {/* Taped onto the page, like everything else in the album. */}
        <span aria-hidden="true" className="absolute -top-2 left-9 h-4 w-11 -rotate-6 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30" />
        <ul className="flex h-16 items-center justify-between px-2.5 sm:h-[4.5rem] sm:px-4">
          <li>{tab("home")}</li>
          <li>{tab("collection")}</li>
          <li>
            <Link
              href={{ pathname: "/collection", query: { add: "1" } }}
              onClick={add}
              className="relative flex size-13 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_6px_16px_-6px_var(--brand)] transition-transform outline-none hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-90"
            >
              {/* A rubber stamp's inner ring. */}
              <span aria-hidden="true" className="absolute inset-[3px] rounded-full border-[1.5px] border-dashed border-brand-foreground/45" />
              <PlusIcon className="size-7" strokeWidth={2.6} aria-hidden="true" />
              <span className="sr-only">{t("add")}</span>
            </Link>
          </li>
          <li>{tab("feed")}</li>
          <li>{tab("me")}</li>
        </ul>
      </nav>
    </div>
  );
}
