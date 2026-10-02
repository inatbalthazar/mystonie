"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { FeedbackLink } from "@/components/beta/feedback-link";

/**
 * A page that broke: try again, or report it (ADR 0055). The report carries the page and the error's digest, so it
 * can be matched with the server's logs. Sentry gets the error when it's set up (it isn't loaded otherwise).
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Beta");
  useEffect(() => {
    console.error(error);
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="h-11 rounded-full bg-brand px-5 font-bold text-brand-foreground hover:bg-brand/90 press">
          {t("retry")}
        </button>
        <FeedbackLink place="button" kind="bug" errorRef={error.digest} />
      </div>
    </main>
  );
}
