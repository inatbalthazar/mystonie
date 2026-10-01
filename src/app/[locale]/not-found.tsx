import { useTranslations } from "next-intl";
import { FeedbackLink } from "@/components/beta/feedback-link";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Link href="/" className="underline underline-offset-4">
        {t("backHome")}
      </Link>
      {/* A broken link is worth a report during the beta (ADR 0055). */}
      <p className="text-sm text-muted-foreground">{t("brokenLink")}</p>
      <FeedbackLink place="button" kind="bug" />
    </main>
  );
}
