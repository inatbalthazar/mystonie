import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BETA } from "@/lib/site";

/** A coral BETA stamp by the logo while Mystonie is in beta (ADR 0055). It opens /feedback: what beta means, and a report form. */
export function BetaBadge() {
  const t = useTranslations("Beta");
  if (!BETA) return null;
  return (
    <Link
      href="/feedback"
      aria-label={t("badgeLabel")}
      className="-rotate-6 rounded-md border-2 border-brand px-1.5 py-px font-display text-[11px] leading-4 font-extrabold tracking-[0.16em] text-brand transition-transform outline-none hover:rotate-0 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t("badge")}
    </Link>
  );
}
