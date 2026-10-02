import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Href = ComponentProps<typeof Link>["href"];

/**
 * The album's divider tabs as links, so each tab is a plain server render, with `aria-current="page"` on the open one:
 * the feed's tabs and Me's Album · Stats. `compact` fits four at 360px. The collection's Watch · Read · Play are
 * the same tabs as buttons (`ShelfTabs`).
 */
export function DividerTabs<T extends string>({
  label,
  tabs,
  current,
  compact = false,
  className,
}: {
  label: string;
  tabs: readonly { value: T; href: Href; name: string }[];
  current: T;
  compact?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 [scrollbar-width:none]", className)}>
      <ul data-tabs className={cn("flex min-w-max border-b-2 border-border", compact ? "gap-1" : "gap-2")}>
        {tabs.map((tab) => (
          <li key={tab.value}>
            <Link
              href={tab.href}
              data-tab
              aria-current={tab.value === current ? "page" : undefined}
              className={cn(
                "-mb-0.5 flex min-h-11 items-center rounded-t-xl border-2 border-b-0 font-display font-extrabold whitespace-nowrap transition-colors",
                compact ? "px-2.5 text-[15px] sm:px-3.5 sm:text-base" : "px-5 text-lg",
                tab.value === current
                  ? "border-border bg-card text-foreground shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
