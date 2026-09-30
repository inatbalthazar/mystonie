"use client";

import { CheckIcon, CloudOffIcon, CloudUploadIcon, TriangleAlertIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { discardOps, retryOps, useOutbox } from "./outbox";

/**
 * The "pending sync" note under the header (S3 offline): offline (with what waits on this device), changes the server
 * refused (Try again / Discard), ones waiting for sign-in or for another account, then "synced" once they go through.
 * Nothing while everything is saved.
 */
export function SyncStatus() {
  const t = useTranslations("Offline");
  const pathname = usePathname();
  const { online, items, synced } = useOutbox();

  const queued = items.filter((i) => i.state === "queued");
  const waiting = queued.filter((i) => i.notBefore);
  const failed = items.filter((i) => i.state === "failed");
  const signedOut = items.filter((i) => i.state === "held" && i.reason === "signed_out");
  const others = items.filter((i) => i.state === "held" && i.reason === "account");
  const ids = (list: typeof items) => list.map((i) => i.id);

  let note: ReactNode = null;
  if (!online) {
    const count = queued.length + signedOut.length;
    note = (
      <Note icon={CloudOffIcon} tone="quiet">
        {count > 0 ? t("offlineWaiting", { count }) : t("offline")}
      </Note>
    );
  } else if (failed.length > 0) {
    note = (
      <Note
        icon={TriangleAlertIcon}
        tone="alert"
        actions={
          <>
            <Action onClick={() => retryOps(ids(failed))}>{t("retry")}</Action>
            <Action onClick={() => discardOps(ids(failed))}>{t("discard")}</Action>
          </>
        }
      >
        {t("failed", { count: failed.length })}
      </Note>
    );
  } else if (signedOut.length > 0) {
    note = (
      <Note
        icon={UserRoundIcon}
        tone="alert"
        actions={
          <Link href={{ pathname: "/auth", query: { next: pathname } }} className={actionClass}>
            {t("signIn")}
          </Link>
        }
      >
        {t("signedOut", { count: signedOut.length })}
      </Note>
    );
  } else if (waiting.length > 0) {
    note = (
      <Note icon={CloudUploadIcon} tone="quiet" actions={<Action onClick={() => retryOps(ids(waiting))}>{t("syncNow")}</Action>}>
        {t("waiting", { count: queued.length })}
      </Note>
    );
  } else if (others.length > 0) {
    note = (
      <Note icon={UserRoundIcon} tone="quiet" actions={<Action onClick={() => discardOps(ids(others))}>{t("discard")}</Action>}>
        {t("otherAccount", { count: others.length })}
      </Note>
    );
  } else if (synced) {
    note = (
      <Note icon={CheckIcon} tone="done">
        {t("synced", { count: synced.count })}
      </Note>
    );
  }
  if (!note) return null;
  return <div className="mx-auto w-full max-w-2xl px-4 pt-3">{note}</div>;
}

const actionClass =
  "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-brand underline-offset-4 hover:bg-brand-soft/60 hover:underline";

function Action({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={actionClass}>
      {children}
    </button>
  );
}

/** A small note taped under the header, like everything else in the album. */
function Note({ icon: Icon, tone, actions, children }: { icon: LucideIcon; tone: "quiet" | "alert" | "done"; actions?: ReactNode; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "relative flex rotate-[-0.4deg] flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-card py-1.5 pr-2 pl-3 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)] ring-1",
        tone === "alert" ? "ring-destructive/40" : tone === "done" ? "ring-brand/40" : "ring-border",
      )}
    >
      <span aria-hidden="true" className="absolute -top-2 left-6 h-4 w-14 -rotate-3 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10" />
      <Icon className={cn("size-4 shrink-0", tone === "alert" ? "text-destructive" : "text-brand")} aria-hidden="true" />
      <p className="min-w-0 flex-1 py-1.5">{children}</p>
      {actions && <span className="flex shrink-0 items-center">{actions}</span>}
    </div>
  );
}
