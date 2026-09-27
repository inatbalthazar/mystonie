import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Stonie + the "mystonie" wordmark, linking home. Below 400px Stonie stands alone, so the signed-in links fit. */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("Card");
  const tn = useTranslations("Nav");
  return (
    <Link href="/" aria-label={tn("home")} className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/icon.svg" alt="" width={36} height={36} priority unoptimized />
      <span className="font-display text-2xl max-[399px]:sr-only font-extrabold tracking-[-0.03em]">{t("brand")}</span>
    </Link>
  );
}
