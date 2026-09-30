"use client";

import { ChartColumnIcon, HouseIcon, LibraryBigIcon, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { localizedPath } from "@/core/auth";
import { routing } from "@/i18n/routing";

const PAGES: { path: "/home" | "/collection" | "/stats"; icon: LucideIcon; label: "home" | "collection" | "stats" }[] = [
  { path: "/home", icon: HouseIcon, label: "home" },
  { path: "/collection", icon: LibraryBigIcon, label: "collection" },
  { path: "/stats", icon: ChartColumnIcon, label: "stats" },
];

/**
 * The offline page's way back: the app's main pages this device has saved (all three until it has checked). Plain
 * links, so the browser asks the service worker for the saved copy.
 */
export function SavedPages() {
  const t = useTranslations("Account");
  const offline = useTranslations("Offline");
  const locale = useLocale();
  const [saved, setSaved] = useState<string[] | null>(null);
  const href = (path: string) => localizedPath(path, locale, routing.defaultLocale);

  useEffect(() => {
    if (!("caches" in window)) return;
    let live = true;
    Promise.all(PAGES.map(async ({ path }): Promise<string | null> => ((await caches.match(new URL(href(path), window.location.origin).href)) ? path : null)))
      .then((found) => live && setSaved(found.filter((p): p is string => p !== null)))
      .catch(() => {});
    return () => {
      live = false;
    };
    // `href` only changes with the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const shown = PAGES.filter(({ path }) => !saved || saved.includes(path));
  if (shown.length === 0) return null;
  return (
    <nav aria-label={offline("savedPages")} className="mt-2 flex flex-wrap justify-center gap-2">
      {shown.map(({ path, icon: Icon, label }) => (
        // A full page load on purpose: offline, the service worker answers it with the saved copy.
        <a key={path} href={href(path)} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-border hover:bg-muted">
          <Icon className="size-4" aria-hidden="true" />
          {t(label)}
        </a>
      ))}
    </nav>
  );
}
