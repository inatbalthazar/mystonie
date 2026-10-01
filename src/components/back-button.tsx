"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { backPage, backParent, backTitle, hasBack, parseBackStack, previousEntry, stepBack, type BackEntry } from "@/core/back";
import { countryName } from "@/core/countries";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isStandalone } from "./pwa/browser";

// The pages visited in this tab (ADR 0061), kept in sessionStorage so a reload keeps them. Best effort: without
// storage the button goes up to the page's parent.
const KEY = "mystonie.back";
let stack: BackEntry[] | null = null;
let poppedAt = 0;

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack));
  } catch {}
}

// Once per page load. A link from another site, or a typed address, starts over: the browser's page before isn't ours.
function load(): BackEntry[] {
  let saved: BackEntry[] = [];
  try {
    saved = parseBackStack(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
  } catch {}
  const type = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
  let fromHere = false;
  try {
    fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {}
  if (type === "reload" || type === "back_forward" || fromHere) return saved;
  return [];
}

function listen() {
  window.addEventListener("popstate", () => (poppedAt = Date.now()));
  // A tap is the moment the page's title is surely this page's: kept for the next page's button.
  document.addEventListener(
    "click",
    () => {
      const top = stack?.at(-1);
      const title = backTitle(document.title);
      if (top && title && top.title !== title) {
        top.title = title;
        save();
      }
    },
    true,
  );
}

// The current page and the one before it, for the button.
let known: { path: string; previous: BackEntry | null } | null = null;
const subscribers = new Set<() => void>();
function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/** The page before this one in the app, once known after hydration (undefined until then). */
function usePrevious(path: string): BackEntry | null | undefined {
  const current = useSyncExternalStore(
    subscribe,
    () => known,
    () => null,
  );
  // Before paint, so a new page never shows its parent's name first.
  useLayoutEffect(() => {
    if (!stack) {
      stack = load();
      listen();
    }
    stack = stepBack(stack, path, Date.now() - poppedAt < 1500);
    poppedAt = 0;
    save();
    known = { path, previous: previousEntry(stack, path) };
    subscribers.forEach((callback) => callback());
  }, [path]);
  return current?.path === path ? current.previous : undefined;
}

/**
 * The iOS-style back button (ADR 0061), at the header's start in place of the logo: "‹ Atlas". It steps back to the page
 * you came from in the app, named after it (its fixed name, its country or @username, or its title), so its scroll and
 * shelf come back too. Opened from a link or a fresh tab, it goes up to the page's parent instead, and pages without one
 * keep the logo. On the tabs themselves there is none. Installed on a phone, where there's no browser back, a swipe
 * from the left edge does the same.
 */
export function BackButton({ children }: { children: ReactNode }) {
  const t = useTranslations("Back");
  const locale = useLocale();
  const router = useRouter();
  const path = usePathname();
  const previous = usePrevious(path);

  if (!hasBack(path)) return children;
  const parent = backParent(path);
  if (!previous && !parent) return children;

  const target = previous ?? { path: parent!.href };
  const page = backPage(target.path);
  const name =
    page.kind === "named"
      ? t(`pages.${page.page}`)
      : page.kind === "country"
        ? countryName(page.country, locale)
        : page.kind === "profile"
          ? t("profile", { username: page.username })
          : target.title;

  function go() {
    if (previous) return router.back(); // the very page, with its query and scroll
    // Up a level takes this page's place, as on iOS: back from the parent doesn't come down here again.
    if (stack?.at(-1)?.path === path) stack = stack.slice(0, -1);
    router.replace(target.path);
  }

  function back(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; // a new tab
    event.preventDefault();
    go();
  }

  // Only signed-in people go up to a signed-in page; someone signed out who opened this from a link keeps the logo.
  const signedInOnly = !previous && parent!.signedIn;
  return (
    <>
      <Link
        href={target.path}
        onClick={back}
        aria-label={name ? t("backTo", { page: name }) : t("back")}
        className={cn(
          "-ml-2 inline-flex h-11 max-w-[min(14rem,55vw)] items-center gap-0.5 rounded-full pr-3 pl-0.5 text-[17px] font-semibold text-brand transition-opacity outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:opacity-50",
          signedInOnly && "hidden signed-in:inline-flex",
        )}
      >
        <ChevronLeftIcon className="size-7 shrink-0" strokeWidth={2.4} aria-hidden="true" />
        <span className="truncate">{name ?? t("back")}</span>
      </Link>
      {signedInOnly && <span className="contents signed-in:hidden">{children}</span>}
      <EdgeSwipe onBack={go} signedInOnly={signedInOnly} />
    </>
  );
}

const EDGE = 20; // px from the left edge where a swipe starts
const GO = 80; // px to drag before letting go steps back

/** Installed on a phone (no browser back there): drag from the left edge, a round "‹" follows the finger, let go past it. */
function EdgeSwipe({ onBack, signedInOnly }: { onBack: () => void; signedInOnly: boolean }) {
  const bubble = useRef<HTMLSpanElement>(null);
  const go = useRef(onBack);
  useEffect(() => {
    go.current = onBack;
  });

  useEffect(() => {
    if (!isStandalone()) return;
    let start: { x: number; y: number } | null = null;
    let dx = 0;
    let engaged = false;

    function show(progress: number) {
      const el = bubble.current;
      if (!el) return;
      el.style.opacity = String(Math.min(progress * 1.4, 1));
      el.style.transform = `translate(${-48 + progress * 60}px, -50%) scale(${progress >= 1 ? 1.1 : 0.85 + progress * 0.15})`;
    }
    function reset() {
      start = null;
      dx = 0;
      engaged = false;
      show(0);
    }
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || e.touches[0].clientX > EDGE) return;
      if (signedInOnly && !document.documentElement.hasAttribute("data-auth")) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    function onMove(e: TouchEvent) {
      if (!start) return;
      dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!engaged) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return reset(); // a scroll
        if (dx > 12) engaged = true;
      }
      if (engaged) show(Math.max(0, Math.min(dx / GO, 1)));
    }
    function onEnd() {
      if (engaged && dx >= GO) go.current();
      reset();
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [signedInOnly]);

  return (
    <span
      ref={bubble}
      aria-hidden="true"
      style={{ opacity: 0, transform: "translate(-48px, -50%)" }}
      className="pointer-events-none fixed top-1/2 left-0 z-50 grid size-11 place-items-center rounded-full bg-card text-brand shadow-lg ring-1 ring-border transition-[transform,opacity] duration-75"
    >
      <ChevronLeftIcon className="size-6" strokeWidth={2.6} />
    </span>
  );
}
