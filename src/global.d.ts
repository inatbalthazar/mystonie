import type en from "../messages/en.json";
import type { routing } from "./i18n/routing";

// Type-checks message keys and locales in useTranslations / getTranslations.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
  }
}
