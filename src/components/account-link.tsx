"use client";

import { ChartColumnIcon, HouseIcon, LibraryBigIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { hasAuthCookie } from "@/core/auth";
import { Link } from "@/i18n/navigation";

const noSubscribe = () => () => {};
const readCookie = () => hasAuthCookie(document.cookie.split("; ").map((c) => c.split("=")[0]!));

const pill = "inline-flex h-11 items-center gap-2 rounded-full text-sm font-semibold ring-1 ring-border hover:bg-muted";

/**
 * Header links: "Sign in", or ➕ (quick add), Home, Collection, Stats and the account when a session cookie is present.
 * Reads the cookie in the browser so public pages stay static (and supabase-js stays out of their bundle);
 * the app pages verify the session.
 */
export function AccountLink() {
  const t = useTranslations("Account");
  const signedIn = useSyncExternalStore(noSubscribe, readCookie, () => false);
  if (!signedIn) {
    return (
      <Link href="/auth" className={`${pill} px-4`}>
        <UserRoundIcon className="size-4" aria-hidden="true" />
        {t("signIn")}
      </Link>
    );
  }
  return (
    <nav className="flex items-center gap-1.5">
      <Link
        href={{ pathname: "/collection", query: { add: "1" } }}
        aria-label={t("add")}
        className="inline-flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
      >
        <PlusIcon className="size-5" aria-hidden="true" />
      </Link>
      {/* Icon only on phones, so the logo, ➕ and account fit at 360px. */}
      <Link href="/home" className={`${pill} w-11 justify-center sm:w-auto sm:px-4`}>
        <HouseIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("home")}</span>
      </Link>
      <Link href="/collection" className={`${pill} w-11 justify-center sm:w-auto sm:px-4`}>
        <LibraryBigIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("collection")}</span>
      </Link>
      <Link href="/stats" className={`${pill} w-11 justify-center sm:w-auto sm:px-4`}>
        <ChartColumnIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("stats")}</span>
      </Link>
      <Link href="/settings" aria-label={t("yourAccount")} className={`${pill} w-11 justify-center`}>
        <UserRoundIcon className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
