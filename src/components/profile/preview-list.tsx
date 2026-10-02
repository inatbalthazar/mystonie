"use client";

import { useState, type ReactNode } from "react";
import { previewClass, ShowAll } from "@/components/show-all";
import { cn } from "@/lib/utils";

/**
 * A server-rendered list that shows its first two rows and "Show all (N)" (mobile checklist, ADR 0069): `phone`
 * items on phones, `wide` from 640px. `itemClassNames` style each item (a tilt).
 */
export function PreviewList({
  items,
  className,
  itemClassNames = [],
  phone,
  wide,
}: {
  items: ReactNode[];
  className?: string;
  itemClassNames?: (string | undefined)[];
  phone: number;
  wide: number;
}) {
  const [all, setAll] = useState(false);
  return (
    <>
      <ul className={cn("stagger", className)}>
        {items.map((item, i) => (
          // The list never reorders while shown: the index is a stable key.
          <li key={i} className={cn(itemClassNames[i], previewClass(i, all, phone, wide))}>
            {item}
          </li>
        ))}
      </ul>
      {items.length > phone && <ShowAll open={all} onToggle={() => setAll(!all)} count={items.length} hiddenFromSm={items.length <= wide} />}
    </>
  );
}
