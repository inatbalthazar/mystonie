"use client";

import { useEffect } from "react";
import { tabDirection, type NavDirection } from "@/core/motion";

// When the app itself went back (the back button, the edge swipe): the popstate that follows keeps "back".
let backAt = 0;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
let setAt = 0;

/** True once the app has hydrated: what mounts after that was opened in the app, not served as the first HTML. */
export let appHydrated = false;

/**
 * Which way the next page transition goes (ADR 0070): `<html data-nav>`, read by the view-transition CSS in
 * globals.css. Kept a few seconds at most, for a page that takes its time to arrive.
 */
export function setNavDirection(direction: NavDirection) {
  document.documentElement.dataset.nav = direction;
  setAt = Date.now();
  clearTimeout(clearTimer);
  clearTimer = setTimeout(clearNavDirection, 8000);
}

/** The app goes back on its own (the back button, the edge swipe): the page slides back the way it came. */
export function markBack() {
  backAt = Date.now();
  setNavDirection("back");
}

/**
 * Steps back through history (`go` calls router.back()) with the page sliding back. React renders a popstate at once,
 * outside any view transition, so this one is started here: the page (`<html data-nav-manual>` names it in
 * globals.css) is captured, history steps back, and the new page is captured two frames later.
 */
export function backWithTransition(go: () => void) {
  markBack();
  const root = document.documentElement;
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
  root.dataset.navManual = "";
  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const done = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        window.addEventListener("popstate", done, { once: true });
        setTimeout(resolve, 800); // a page that takes longer arrives without the slide
        go();
      }),
  );
  transition.finished.finally(() => {
    delete root.dataset.navManual;
    settleNavDirection(0);
  });
}

/** No direction: the next transition is a crossfade. */
export function clearNavDirection() {
  clearTimeout(clearTimer);
  delete document.documentElement.dataset.nav;
}

/** A transition started: once it has played (`ms`), the direction goes, unless a newer tap set another meanwhile. */
export function settleNavDirection(ms: number) {
  const at = setAt;
  setTimeout(() => {
    if (setAt === at) clearNavDirection();
  }, ms);
}

/** A tab in a row of tabs (`data-tabs`, each `data-tab`): sideways from the open one, in the row's order. */
function tabMove(tab: Element): NavDirection {
  const row = tab.closest("[data-tabs]");
  if (!row) return "tab";
  const tabs = [...row.querySelectorAll("[data-tab]")];
  const open = tabs.findIndex((t) => t.getAttribute("aria-current") === "page" || t.getAttribute("aria-pressed") === "true");
  return tabDirection(open, tabs.indexOf(tab)) ?? "tab";
}

/** Which way a tap on this link or tab goes: the island's tabs crossfade, a page's tabs go sideways, the rest forward. */
function directionOf(target: Element): NavDirection | null {
  const tab = target.closest("[data-tab]");
  if (tab) return tabMove(tab);
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link) return null;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null;
  if (link.closest("[data-nav-island]")) return "tab";
  if (link.hasAttribute("data-nav-back")) return "back";
  return "forward";
}

/**
 * Sets the page transition's direction from what was tapped (in the layout, renders nothing). The browser's own back
 * and forward don't slide: phones animate those themselves (iOS's swipe), and two slides would fight.
 */
export function NavMotion() {
  useEffect(() => {
    appHydrated = true;
    // From now on, pages and lists that arrive settle in (globals.css). The page and lists already here stay as they
    // are: their entrances end before the next paint. (No marker attribute on them: React still has parts of the page
    // to hydrate, and an attribute it didn't render is a hydration mismatch.)
    document.documentElement.dataset.app = "";
    for (const animation of document.getAnimations()) {
      const effect = animation instanceof CSSAnimation && animation.animationName === "enter" ? animation.effect : null;
      const target = effect instanceof KeyframeEffect ? effect.target : null;
      if (target?.matches("body > main, .stagger > *")) animation.finish();
    }
    // Once a page transition has played, its direction goes. A page shown from the router's cache (ADR 0075) doesn't
    // always tell its <ViewTransition> it entered (`settleNavDirection` in PageTransition), so this doesn't rely on it.
    const start = document.startViewTransition?.bind(document);
    if (start) {
      document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
        const at = setAt;
        const transition = start(arg);
        void transition.finished.finally(() => {
          if (setAt === at) clearNavDirection();
        });
        return transition;
      }) as typeof document.startViewTransition;
    }
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const direction = event.target instanceof Element ? directionOf(event.target) : null;
      if (direction) setNavDirection(direction);
    }
    function onPopState() {
      if (Date.now() - backAt > 1000) setNavDirection("none");
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      if (start) document.startViewTransition = start;
    };
  }, []);
  return null;
}
