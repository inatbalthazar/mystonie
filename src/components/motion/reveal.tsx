"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

/**
 * Bars, charts, progress and cards that come in every time they're shown (ADR 0080). Inside it, `.grow-w` fills grow
 * from no width to theirs, `.grow-h` bars from no height, and `.grow-pop` cells pop in; a Reveal with `.deal` is a
 * card dealt onto the page, and one with `.rise` a paper card rising into place (globals.css), each after its
 * `--grow-delay`. They play when the page shows them (first HTML included, straight from the CSS), and again each time
 * they scroll back into view: `data-shown` comes off while they're out of sight, which ends the animation, and back on
 * when they're in. Reduced motion: they're simply there.
 */
export function Reveal({ as = "div", ...props }: { as?: "div" | "section" | "li" } & ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  // On in the server's HTML too, so the first paint already grows; the observer takes it off while out of sight.
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShown(entry!.isIntersecting), { rootMargin: "0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A section or a list item takes a div's props here; the cast only spares the union of element types.
  const Tag = as as "div";
  return <Tag ref={ref} data-reveal="" data-shown={shown ? "" : undefined} {...props} />;
}
