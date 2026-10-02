"use client";

import { ViewTransition, type ReactNode } from "react";
import { settleNavDirection } from "./nav-motion";

// Longer than the slowest page animation (globals.css), so the direction holds until both halves have played.
const SETTLE_MS = 500;

/**
 * The page slides in, so its own entrance (globals.css: `body > main` settling in) would only fade it twice: it ends
 * at once, and the slide alone brings it in. A skeleton keeps its late fade (ADR 0075), so a page that comes within
 * 300ms never flashes one.
 */
function endEntrances() {
  for (const main of document.querySelectorAll("body > main:not([data-skeleton])")) {
    for (const animation of main.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName === "enter") {
        animation.finish();
      }
    }
  }
}

/**
 * A page that slides in and out as you move around the app (ADR 0070): the `template.tsx` files wrap their pages in
 * it, so a new page enters and the old one leaves (`.page` in globals.css, which way from `<html data-nav>`). With a
 * `key` (the feed's `?tab=`), the same page's content does it too. Updates within a page don't animate.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter="page"
      exit="page"
      default="none"
      onEnter={() => {
        endEntrances();
        settleNavDirection(SETTLE_MS);
      }}
    >
      {children}
    </ViewTransition>
  );
}
