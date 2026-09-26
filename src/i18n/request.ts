import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { mergeMessages, type Messages } from "./merge-messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // en.json is the source of truth. Other locales may lag and fall back to English per key.
  const messages =
    locale === routing.defaultLocale
      ? en
      : mergeMessages(en, (await import(`../../messages/${locale}.json`)).default as Messages);

  return { locale, messages };
});
