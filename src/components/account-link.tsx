import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * The header's "Sign in", shown by CSS while signed out (`signed-out:`, from the pre-paint hint in src/core/auth.ts).
 * Signed in, the nav island takes over (ADR 0050), so public pages stay static.
 */
export function AccountLink() {
  const t = useTranslations("Account");
  return (
    <Link
      href="/auth"
      className="hidden h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-border signed-out:inline-flex hover:bg-muted"
    >
      <UserRoundIcon className="size-4" aria-hidden="true" />
      {t("signIn")}
    </Link>
  );
}
