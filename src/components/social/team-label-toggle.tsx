"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/** The team's welcome desk: the Team label on your own account, on or off (ADR 0098). */
export function TeamLabelToggle({ on }: { on: boolean }) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    setBusy(true);
    setFailed(false);
    const response = await fetch("/api/admin/team-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: !on }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) return setFailed(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{on ? t("labelOn") : t("labelOff")}</p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          on
            ? "inline-flex h-11 items-center self-start rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press disabled:opacity-60"
            : "inline-flex h-11 items-center self-start rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press disabled:opacity-60"
        }
      >
        {on ? t("labelRemove") : t("labelAdd")}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("labelError")}
        </p>
      )}
    </div>
  );
}
