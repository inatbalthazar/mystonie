"use client";

import { BanIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Sheet } from "../sheet";

/**
 * Block / Unblock (S3 social). Blocking asks first (it also removes follows and Stamps between the two of you);
 * unblocking doesn't. The page reloads its data afterwards.
 */
export function BlockButton({ userId, username, blocked, className }: { userId: string; username: string; blocked: boolean; className?: string }) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(block: boolean) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, block }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setOpen(false);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const error = (
    <span aria-live="polite" className="text-sm text-destructive empty:hidden">
      {failed ? t("problem", { problem: "error" }) : ""}
    </span>
  );

  if (blocked) {
    return (
      <span className={cn("inline-flex flex-col items-center gap-1", className)}>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ring-1 ring-border hover:bg-muted disabled:opacity-50"
        >
          {t("unblock")}
        </button>
        {error}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", className)}
      >
        <BanIcon className="size-4" aria-hidden="true" />
        {t("block")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("blockTitle", { username })} closeLabel={t("close")}>
        <p className="text-muted-foreground">{t("blockBody")}</p>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={busy}
          className="h-12 rounded-2xl bg-destructive px-5 font-bold text-white shadow-sm hover:bg-destructive/90 disabled:opacity-50"
        >
          {busy ? t("blocking") : t("blockConfirm", { username })}
        </button>
        {error}
      </Sheet>
    </>
  );
}
