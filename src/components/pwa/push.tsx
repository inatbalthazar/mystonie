"use client";

import { BellRingIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type ReactNode } from "react";
import { fromBase64Url } from "@/core/push";
import { cn } from "@/lib/utils";
import { dismissedRecently, isIos, isStandalone, pushSupported, rememberDismissed } from "./browser";

// Weekly Recap notifications for installed apps (ADR 0028). The browser holds the subscription; the server keeps
// a copy per device (POST/DELETE /api/push) and pushes each new recap to it.

type PushState =
  | "loading"
  /** Not installed (or no push in this browser): only an installed app gets notifications. */
  | "install"
  | "blocked"
  | "off"
  | "on";

const SW_URL = "/sw.js";

async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function saveOnServer(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  return res.ok;
}

/** `resync`: re-send an existing subscription (Settings), so it follows whoever is signed in on this device. */
function usePush(publicKey: string, resync = false) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const settle = (next: PushState) => live && setState(next);
    (async () => {
      if (!pushSupported() || !isStandalone()) return settle("install");
      if (Notification.permission === "denied") return settle("blocked");
      const subscription = await existingSubscription();
      settle(subscription ? "on" : "off");
      if (subscription && resync) await saveOnServer(subscription).catch(() => {});
    })().catch(() => settle("off"));
    return () => {
      live = false;
    };
  }, [resync]);

  async function enable(): Promise<boolean> {
    setBusy(true);
    setFailed(false);
    try {
      // Asked only here, after a tap on our own switch or button.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return false;
      }
      await navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey)! }));
      if (!(await saveOnServer(subscription))) throw new Error("not saved");
      setState("on");
      return true;
    } catch {
      setFailed(true);
      setState("off");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setFailed(false);
    try {
      const subscription = await existingSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, failed, enable, disable };
}

/**
 * Settings → Notifications: a switch in the installed app, else how to install. `children` (more kinds of
 * notifications, like Reel of the Day reminders) show while notifications are on.
 */
export function PushSwitch({ publicKey, children }: { publicKey: string; children?: ReactNode }) {
  const t = useTranslations("Settings");
  const id = useId();
  const { state, busy, failed, enable, disable } = usePush(publicKey, true);
  const on = state === "on";

  if (state === "install") {
    return <p className="text-sm text-muted-foreground">{t(isIos() ? "pushInstallIos" : "pushInstall")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-label`} className="font-medium">
            {t("pushRecaps")}
          </p>
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {t(state === "blocked" ? "pushBlocked" : "pushRecapsHint")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={() => (on ? disable() : enable())}
          disabled={busy || state === "loading" || state === "blocked"}
          className="flex h-11 w-16 shrink-0 items-center justify-center disabled:opacity-60"
        >
          <span className={cn("flex h-7 w-12 items-center rounded-full p-1 transition-colors", on ? "bg-brand" : "bg-muted ring-1 ring-border")}>
            <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-5")} />
          </span>
        </button>
      </div>
      <p aria-live="polite" className={cn("text-sm text-destructive", !failed && "sr-only")}>
        {failed ? t("pushError") : ""}
      </p>
      {on && children && <div className="border-t border-dashed border-border pt-3">{children}</div>}
    </div>
  );
}

const PROMPT_DISMISSED = "mystonie.push.dismissed";

/** Home, in the installed app: a note offering recap notifications until they're on or dismissed. */
export function PushPrompt({ publicKey }: { publicKey: string }) {
  const t = useTranslations("HomeApp");
  const { state, busy, failed, enable } = usePush(publicKey);
  const [hidden, setHidden] = useState(false);
  const [dismissed] = useState(() => typeof window !== "undefined" && dismissedRecently(PROMPT_DISMISSED));
  if (hidden || dismissed || state !== "off") return null;

  return (
    <aside className="relative flex rotate-[0.4deg] flex-col gap-3 rounded-2xl bg-card p-4 pt-5 shadow-sm ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-3 right-10 h-6 w-16 rotate-[5deg] rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-border" />
      <p className="flex items-center gap-2 font-semibold">
        <BellRingIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
        {t("pushTitle")}
      </p>
      <p className="text-sm text-muted-foreground">{failed ? t("pushError") : t("pushBody")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await enable()) setHidden(true);
          }}
          disabled={busy}
          className="h-11 rounded-full bg-brand px-4 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
        >
          {t("pushOn")}
        </button>
        <button
          type="button"
          onClick={() => {
            rememberDismissed(PROMPT_DISMISSED);
            setHidden(true);
          }}
          className="h-11 rounded-full px-4 font-semibold ring-1 ring-border hover:bg-muted press"
        >
          {t("notNow")}
        </button>
      </div>
    </aside>
  );
}

/**
 * Signing out also turns this device's notifications off (the browser's subscription and the server's copy),
 * so whoever uses the device next doesn't get the user's recaps. Gives up after 2 seconds: signing out wins.
 */
export async function pushEndpointForSignOut(): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const work = (async () => {
    const subscription = await existingSubscription();
    if (!subscription) return null;
    await subscription.unsubscribe().catch(() => false);
    return subscription.endpoint;
  })();
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))]).catch(() => null);
}
