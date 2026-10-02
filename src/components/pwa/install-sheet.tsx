"use client";

import { CheckIcon, EllipsisVerticalIcon, ExternalLinkIcon, LinkIcon, ShareIcon, SquarePlusIcon } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { installWay, quietForInstall, type InstallWay } from "@/core/install";
import { routing } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { Sheet } from "../sheet";
import { dismissedRecently, INSTALL_DISMISSED, installPromptReady, isStandalone, promptInstall, rememberDismissed, subscribeInstall } from "./browser";

/** How long a visitor looks around before being asked (and again, if another sheet was open then). */
const DELAY_MS = 6000;
/** The ways there are to ask (never "none"). */
type Asked = Exclude<InstallWay, "none">;
/** Asked once per visit, even when they wander to other pages without answering. */
const ASKED = "mystonie.install.asked";

function askedThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(ASKED) === "1";
  } catch {
    return false;
  }
}

function rememberAsked() {
  try {
    window.sessionStorage.setItem(ASKED, "1");
  } catch {
    // Storage blocked: the 30-day "Not now" still holds once they answer.
  }
}

function deviceWay(): InstallWay {
  return installWay({
    ua: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    promptReady: installPromptReady(),
    touch: window.matchMedia("(pointer: coarse)").matches,
    robot: navigator.webdriver === true,
  });
}

/**
 * Visitors on a phone (ADR 0085): a few seconds into their first visit, a sheet asks them to put Mystonie on their home
 * screen, before any sign-up. Chromium gets an Install button (its own dialog), iOS the Share → Add to Home Screen
 * steps, other Android browsers their menu, and an app's own browser (Instagram, LINE…) how to open the page in the
 * real one. Signed-in people get Home's install card instead (ADR 0028); one "Not now" quiets both for 30 days.
 */
export function InstallSheet() {
  const t = useTranslations("Install");
  const pathname = usePathname();
  const ready = useSyncExternalStore(subscribeInstall, installPromptReady, () => false);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [copied, setCopied] = useState(false);
  // Chrome may offer its dialog only after the sheet opened: then the steps become the Install button.
  const way: Asked | null = asked && ready ? "prompt" : asked;

  useEffect(() => {
    if (asked) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const visitor = !document.documentElement.hasAttribute("data-auth");
      if (!visitor || askedThisVisit() || dismissedRecently(INSTALL_DISMISSED) || quietForInstall(pathname, routing.locales)) return;
      // Never on top of another sheet (the card maker's, a title's details): wait for it to close.
      if (document.querySelector("dialog[open]")) {
        timer = setTimeout(check, DELAY_MS);
        return;
      }
      const found = deviceWay();
      if (found === "none") return;
      rememberAsked();
      setAsked(found);
      track("install_prompt", { action: "shown", way: found });
    };
    timer = setTimeout(check, DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, asked]);

  function close(action: "dismissed" | "installed") {
    if (!way) return;
    rememberDismissed(INSTALL_DISMISSED);
    track("install_prompt", { action, way });
    setAsked(null);
  }

  return (
    <Sheet open={way !== null} onClose={() => close("dismissed")} title={t("title")} closeLabel={t("close")}>
      <div className="flex flex-col gap-5">
        {/* A home screen with Mystonie on it: what they'll get. */}
        <div aria-hidden="true" className="mx-auto grid grid-cols-4 gap-x-4 gap-y-3 rounded-[28px] bg-brand-soft/70 p-4 dark:bg-brand/15">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="size-12 rounded-[14px] bg-foreground/8" />
          ))}
          <span className="flex flex-col items-center gap-1">
            <Image src="/icon.svg" alt="" width={48} height={48} unoptimized className="size-12 -rotate-6 rounded-[14px] shadow-md ring-2 ring-brand" />
            <span className="text-[11px] font-semibold">{t("appName")}</span>
          </span>
        </div>
        <p className="text-muted-foreground">{way === "in_app" ? t("inAppBody") : t("body")}</p>

        {way === "ios" && (
          <Steps>
            <Step icon={<ShareIcon />}>{t("iosShare")}</Step>
            <Step icon={<SquarePlusIcon />}>{t("iosAdd")}</Step>
          </Steps>
        )}
        {way === "menu" && (
          <Steps>
            <Step icon={<EllipsisVerticalIcon />}>{t("menuOpen")}</Step>
            <Step icon={<SquarePlusIcon />}>{t("menuAdd")}</Step>
          </Steps>
        )}
        {way === "in_app" && (
          <Steps>
            <Step icon={<EllipsisVerticalIcon />}>{t("inAppMenu")}</Step>
            <Step icon={<ExternalLinkIcon />}>{t("inAppOpen")}</Step>
          </Steps>
        )}

        <div className="flex flex-col gap-2">
          {way === "prompt" && (
            <button
              type="button"
              onClick={async () => {
                if (await promptInstall()) close("installed");
              }}
              className="h-12 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
            >
              {t("install")}
            </button>
          )}
          {way === "in_app" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                } catch {
                  // No clipboard here: the steps above still work.
                }
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
            >
              {copied ? <CheckIcon className="size-5" aria-hidden="true" /> : <LinkIcon className="size-5" aria-hidden="true" />}
              {copied ? t("copied") : t("copyLink")}
            </button>
          )}
          <button type="button" onClick={() => close("dismissed")} className="h-12 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press">
            {way === "prompt" ? t("notNow") : t("done")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col gap-2">{children}</ol>;
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 text-sm font-medium [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-brand">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
        {icon}
      </span>
      {children}
    </li>
  );
}
