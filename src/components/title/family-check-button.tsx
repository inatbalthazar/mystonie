"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, useTransition } from "react";
import { FAMILY_TOPIC_IDS } from "@/core/warnings";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics";

const noSubscribe = () => () => {};

/**
 * "Check for family viewing" (stage 4): one tap saves the family set of avoid-topics (they stay editable in
 * Settings) and reloads the page, whose check then answers them.
 */
export function FamilyCheckButton() {
  const t = useTranslations("TitleCheck");
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  // Disabled until hydrated: a tap before then would do nothing.
  const ready = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  async function choose() {
    setFailed(false);
    const ok = await fetch("/api/warnings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicIds: FAMILY_TOPIC_IDS }),
    })
      .then((res) => res.ok)
      .catch(() => false);
    if (!ok) return setFailed(true);
    track("family_check_chosen", {});
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={choose}
        disabled={busy || !ready}
        className="inline-flex h-11 items-center rounded-xl bg-brand px-5 font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
      >
        {busy ? t("checking") : t("family")}
      </button>
      {failed && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {t("familyError")}
        </p>
      )}
    </div>
  );
}
