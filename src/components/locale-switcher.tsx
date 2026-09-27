"use client";

import { useLocale, useTranslations, type Locale } from "next-intl";
import { useState, useSyncExternalStore, useTransition } from "react";
import { hasAuthCookie } from "@/core/auth";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { saveAccount } from "./settings/save-account";

// Each language is shown in its own script ("English", "ไทย") via Intl, so no names are hard-coded.
export function nativeName(locale: Locale) {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

const noSubscribe = () => () => {};
const readSignedIn = () => hasAuthCookie(document.cookie.split("; ").map((c) => c.split("=")[0]!));

/**
 * Switches the UI language. Signed in, the choice is saved to the profile first (the proxy sends signed-in
 * users to their saved language, S1 profile); if saving fails the page stays put and `failed` is set.
 */
export function useChangeLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = useSyncExternalStore(noSubscribe, readSignedIn, () => false);
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  async function change(next: Locale) {
    setFailed(false);
    if (signedIn && !(await saveAccount({ locale: next })).ok) return setFailed(true);
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }
  return { change, isPending, failed };
}

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const { change, isPending } = useChangeLocale();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {t("label")}
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-foreground disabled:opacity-50"
        value={locale}
        disabled={isPending}
        onChange={(event) => change(event.target.value as Locale)}
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
