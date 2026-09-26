import { defineRouting } from "next-intl/routing";

// English is the default and has no URL prefix (`/stats`). Other locales are prefixed (`/th/stats`). ADR 0007.
// The URL alone decides the locale: no Accept-Language redirect and no locale cookie, so every visitor lands in English.
export const routing = defineRouting({
  locales: ["en", "th"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});
