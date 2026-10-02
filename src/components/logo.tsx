import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Stonie } from "./stonie";

/** Stonie (alive, ADR 0086) + the "mystonie" wordmark, linking home. */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("Card");
  const tn = useTranslations("Nav");
  return (
    <Link href="/" aria-label={tn("home")} className={cn("inline-flex items-center gap-2", className)}>
      <Stonie size={36} />
      <span className="font-display text-2xl font-extrabold tracking-[-0.03em]">{t("brand")}</span>
    </Link>
  );
}
