"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

type Status = "idle" | "confirm" | "deleting" | "done" | "error";

/** Settings → Delete account: two taps, then everything goes (DELETE /api/account). */
export function DeleteAccount() {
  const t = useTranslations("Settings");
  const [status, setStatus] = useState<Status>("idle");

  async function remove() {
    setStatus("deleting");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <section role="status" className="flex flex-col gap-3 rounded-2xl bg-muted p-5">
        <p className="font-medium">{t("deleted")}</p>
        <Link href="/" className="font-semibold text-brand underline-offset-4 hover:underline">
          {t("backHome")}
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-destructive/40 p-5">
      <h2 className="font-display text-lg font-bold">{t("deleteTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("deleteBody")}</p>
      {status === "idle" ? (
        <button
          type="button"
          onClick={() => setStatus("confirm")}
          className="h-11 self-start rounded-xl px-5 font-semibold text-destructive ring-1 ring-destructive/40 hover:bg-destructive/10"
        >
          {t("deleteButton")}
        </button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={remove}
            disabled={status === "deleting"}
            className="h-11 rounded-xl bg-destructive px-5 font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"
          >
            {status === "deleting" ? t("deleting") : t("deleteConfirm")}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            disabled={status === "deleting"}
            className="h-11 rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted"
          >
            {t("cancel")}
          </button>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-destructive">
        {status === "error" ? t("deleteError") : ""}
      </p>
    </section>
  );
}
