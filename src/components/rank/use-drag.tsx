"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A finger held this long picks a thing up; moving sooner is a scroll. */
const HOLD_MS = 220;
/** How far a pointer moves before it counts as moving. */
const SLOP = 8;
/** Near the top of the screen, or over the nav island and the sticky button above it, the page scrolls while dragging. */
const EDGE_TOP = 72;
const EDGE_BOTTOM = 200;
const SCROLL_MAX = 14;

/**
 * What under the pointer matches `selector`, looking through what floats over the page (the nav island, a sticky
 * button), so a thing can be dropped on a row half hidden behind them.
 */
export function under(x: number, y: number, selector: string): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const found = el.closest<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

type Held = { id: string; x: number; y: number; width: number; height: number; offsetX: number; offsetY: number };

/**
 * Drag and drop for a ranking (ADR 0100), in a few lines of pointer events instead of a package. A mouse drags at once;
 * a finger holds a moment first so a swipe still scrolls the page, except on a handle (`touch-action: none`), which
 * drags at once too. While dragging, a copy of the thing follows the pointer (`ghost`), the page scrolls near the
 * screen's edges, and `onMove` gets the pointer, to move the thing in the list as it goes; the list itself shows
 * where it will land. Taps that weren't drags still reach the thing's own click.
 */
export function useDrag({ onMove, onEnd }: { onMove: (id: string, x: number, y: number) => void; onEnd?: (id: string) => void }) {
  const [held, setHeld] = useState<Held | null>(null);
  const live = useRef({ onMove, onEnd });
  useLayoutEffect(() => {
    live.current = { onMove, onEnd };
  });
  const point = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const eatClick = useRef(false);
  const draggingRef = useRef(false);
  // Once something is picked up, the finger moves it instead of the page.
  const block = useRef((e: TouchEvent) => {
    if (draggingRef.current) e.preventDefault();
  });
  useEffect(() => {
    // Listening from before the touch starts: a browser settles at the touch's start whether its moves can be stopped.
    const blocker = block.current;
    window.addEventListener("touchmove", blocker, { passive: false });
    return () => {
      window.removeEventListener("touchmove", blocker);
      stopRef.current?.();
    };
  }, []);

  function begin(event: ReactPointerEvent<HTMLElement>, id: string, handle: boolean) {
    if (event.button !== 0 || stopRef.current) return;
    const el = event.currentTarget;
    // The thing's own controls (a note's field, ✕) stay theirs.
    const control = (event.target as HTMLElement).closest("input, textarea, select, button, a");
    if (control && control !== el && !control.hasAttribute("data-drag-handle")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    // A touch's moves go to what it started on even once that's gone from the page (a poster moved to another row is
    // drawn anew), where they no longer reach the window: stopped there too.
    const touched = event.target as HTMLElement;
    touched.addEventListener("touchmove", block.current, { passive: false });
    const hold = event.pointerType === "touch" && !handle;
    let dragging = false;
    let frame = 0;
    point.current = { x: startX, y: startY };

    function start() {
      dragging = draggingRef.current = true;
      const rect = el.getBoundingClientRect();
      setHeld({ id, x: point.current.x, y: point.current.y, width: rect.width, height: rect.height, offsetX: startX - rect.left, offsetY: startY - rect.top });
      navigator.vibrate?.(10);
      frame = requestAnimationFrame(scroll);
    }
    function scroll() {
      const { x, y } = point.current;
      const bottom = window.innerHeight - EDGE_BOTTOM;
      const by = y < EDGE_TOP ? -Math.min(1, (EDGE_TOP - y) / EDGE_TOP) : y > bottom ? Math.min(1, (y - bottom) / EDGE_BOTTOM) : 0;
      if (by) {
        window.scrollBy(0, by * SCROLL_MAX);
        live.current.onMove(id, x, y);
      }
      frame = requestAnimationFrame(scroll);
    }
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      point.current = { x: e.clientX, y: e.clientY };
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) <= SLOP) return;
        if (hold) return stop(); // moved before the hold: a scroll
        start();
      }
      const ghost = ghostRef.current;
      if (ghost) ghost.style.translate = `${e.clientX}px ${e.clientY}px`;
      live.current.onMove(id, e.clientX, e.clientY);
    }
    function up(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      if (dragging) {
        // The click that follows a drop isn't a tap.
        eatClick.current = true;
        setTimeout(() => (eatClick.current = false), 0);
        live.current.onEnd?.(id);
      }
      stop();
    }
    const timer = hold ? setTimeout(start, HOLD_MS) : null;
    function stop() {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      touched.removeEventListener("touchmove", block.current);
      stopRef.current = null;
      if (dragging) setHeld(null);
      dragging = draggingRef.current = false;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    stopRef.current = stop;
  }

  /** What makes a thing draggable. `handle`: a grip that drags at once, even under a finger. */
  const bind = (id: string, { handle = false }: { handle?: boolean } = {}) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(e, id, handle),
    onClickCapture: (e: MouseEvent) => {
      if (!eatClick.current) return;
      e.preventDefault();
      e.stopPropagation();
    },
    // A held finger brings no menu, and images aren't dragged out of the page.
    onContextMenu: (e: MouseEvent) => stopRef.current && e.preventDefault(),
    onDragStart: (e: MouseEvent) => e.preventDefault(),
  });

  /** The copy of the thing under the pointer while it's dragged. */
  function ghost(render: (id: string) => ReactNode) {
    if (!held) return null;
    const style: CSSProperties = {
      width: held.width,
      height: held.height,
      // Where it was picked up; moves set it from then on (React leaves it, as this never changes).
      translate: `${held.x}px ${held.y}px`,
      marginLeft: -held.offsetX,
      marginTop: -held.offsetY,
    };
    return createPortal(
      <div ref={ghostRef} aria-hidden="true" style={style} className="pointer-events-none fixed top-0 left-0 z-50">
        <div className="size-full scale-[1.03] -rotate-1 drop-shadow-xl">{render(held.id)}</div>
      </div>,
      document.body,
    );
  }

  return { dragging: held?.id ?? null, bind, ghost };
}
