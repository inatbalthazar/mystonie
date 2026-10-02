"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { SWIPE_EDGE, swipeFade, swipeFollow, swipeIntent, swipeLeave, swipeResult } from "@/core/motion";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { setNavDirection } from "./nav-motion";

type Side = "prev" | "next";

/** Things a sideways drag belongs to: fields, sheets, rows that scroll sideways, and anything handling its own drags. */
function ownsDrag(target: Element, area: Element): boolean {
  if (target.closest("input, textarea, select, [contenteditable], dialog, [data-no-swipe]")) return true;
  for (let node: Element | null = target; node && node !== area; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.scrollWidth > node.clientWidth + 1 && (style.overflowX === "auto" || style.overflowX === "scroll")) return true;
    if (style.touchAction === "none" || style.touchAction === "pan-y") return true;
  }
  return false;
}

// A page swiped away waits this long (ms) at most for the next tab, then comes back (the tab never came).
const LEAVE_MS = 6000;

/**
 * Swipe between a page's tabs (ADR 0070), Threads-style: the content goes with the finger and fades, and a swipe left
 * opens the next tab, right the one before (`prev` / `next` as links, or `onSwipe` with `canSwipe` for tabs on the
 * page itself). Let go, the content carries on out and waits there; the page transition then slides it off as the next
 * tab slides in from the other side. Toward no tab it only gives, like a rubber band. Only a shortcut for the tabs on
 * screen. Not from the screen's side edges (the system's back gesture), nor on rows that scroll sideways, fields or
 * sheets.
 */
export function SwipeArea({
  prev,
  next,
  onSwipe,
  canSwipe,
  className,
  children,
}: {
  prev?: string | null;
  next?: string | null;
  onSwipe?: (side: Side) => boolean;
  canSwipe?: (side: Side) => boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const go = useRef<(side: Side) => boolean>(() => false);
  const can = useRef<(side: Side) => boolean>(() => false);
  // Set while the content waits out of the way for the next tab.
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    go.current = (side) => {
      if (onSwipe) return onSwipe(side);
      const href = side === "next" ? next : prev;
      if (!href) return false;
      setNavDirection(side === "next" ? "tab-next" : "tab-prev");
      router.push(href);
      return true;
    };
    can.current = (side) => (canSwipe ? canSwipe(side) : Boolean(side === "next" ? next : prev));
  });

  // The next tab is in (this render commits it, inside the page transition): the area is back in place for it, while
  // the transition's picture of the old tab, taken out of the way, slides on off.
  useLayoutEffect(() => {
    if (!leaving.current) return;
    clearTimeout(leaving.current);
    leaving.current = null;
    const area = ref.current;
    if (!area) return;
    area.style.transition = area.style.translate = area.style.opacity = "";
  });

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let start: { x: number; y: number; at: number } | null = null;
    let mode: ReturnType<typeof swipeIntent> = "pending";
    let dx = 0;

    function place(x: number, settle: boolean) {
      if (!area || still.matches) return;
      area.style.transition = settle ? "translate 260ms var(--ease-out-soft), opacity 260ms ease-out" : "none";
      area.style.translate = x ? `${x}px 0` : "";
      area.style.opacity = x ? String(swipeFade(x, area.offsetWidth)) : "";
    }
    function reset() {
      if (mode === "horizontal" && !leaving.current) place(0, true);
      start = null;
      mode = "pending";
      dx = 0;
    }
    function onStart(e: TouchEvent) {
      if (leaving.current) return; // already on its way to the next tab
      reset();
      if (e.touches.length !== 1 || !(e.target instanceof Element)) return;
      const { clientX: x, clientY: y } = e.touches[0];
      if (x < SWIPE_EDGE || x > innerWidth - SWIPE_EDGE || ownsDrag(e.target, area!)) return;
      start = { x, y, at: e.timeStamp };
    }
    function onMove(e: TouchEvent) {
      if (!start || e.touches.length !== 1) return;
      dx = e.touches[0].clientX - start.x;
      if (mode === "pending") mode = swipeIntent(dx, e.touches[0].clientY - start.y);
      if (mode === "vertical") return void (start = null);
      if (mode === "horizontal") place(swipeFollow(dx, area!.offsetWidth, can.current(dx < 0 ? "next" : "prev")), false);
    }
    function onEnd(e: TouchEvent) {
      if (start && mode === "horizontal") {
        const side = swipeResult(dx, e.timeStamp - start.at);
        if (side && go.current(side)) {
          haptic(6);
          place(swipeLeave(swipeFollow(dx, area!.offsetWidth), area!.offsetWidth), true);
          leaving.current = setTimeout(() => {
            leaving.current = null;
            place(0, true);
          }, LEAVE_MS);
        }
      }
      reset();
    }
    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: true });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", reset);
    return () => {
      if (leaving.current) clearTimeout(leaving.current);
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", reset);
    };
  }, []);

  return (
    <div ref={ref} data-swipe-area className={className}>
      {children}
    </div>
  );
}
