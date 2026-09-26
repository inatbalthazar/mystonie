"use client";

import { useLocale, useTranslations, type Locale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language is shown in its own script ("English", "ไทย") via Intl, so no names are hard-coded.
function nativeName(locale: Locale) {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {t("label")}
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-foreground disabled:opacity-50"
        value={locale}
        disabled={isPending}
        onChange={(event) => onChange(event.target.value as Locale)}
      >
        {routing.locales.map((option) => (
          <option key={option} value={option} lang={option}>
            {nativeName(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
