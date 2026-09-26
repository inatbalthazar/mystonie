import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

// Public, indexable pages. Add new ones here as they ship.
const pages = ["/"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const url = (href: (typeof pages)[number], locale: (typeof routing.locales)[number]) =>
    new URL(getPathname({ href, locale }), base).href;

  return pages.map((href) => ({
    url: url(href, routing.defaultLocale),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((locale) => [locale, url(href, locale)])),
        "x-default": url(href, routing.defaultLocale),
      },
    },
  }));
}
