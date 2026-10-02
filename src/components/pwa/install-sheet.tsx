"use client";

import { AppWindowMacIcon, CheckIcon, EllipsisVerticalIcon, ExternalLinkIcon, LinkIcon, MonitorDownIcon, ShareIcon, SmartphoneIcon, SquarePlusIcon } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { askedInstallWay, installWay, quietForInstall, type InstallWay } from "@/core/install";
import { routing } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { Sheet } from "../sheet";
import {
  dismissedRecently,
  INSTALL_DISMISSED,
  INSTALL_QUIET_DAYS,
  installPromptReady,
  isStandalone,
  markInstalled,
  onAskToInstall,
  promptInstall,
  rememberDismissed,
  subscribeInstall,
  wasInstalled,
} from "./browser";

/** How long a visitor looks around before being asked (and again, if another sheet was open then). */
const DELAY_MS = 3000;
/** Someone signed in is asked almost at once: installing comes before using it in the browser (ADR 0088). */
const SIGNED_IN_DELAY_MS = 1500;
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
    // Storage blocked: "Not now" still holds once they answer.
  }
}

const signedIn = () => document.documentElement.hasAttribute("data-auth");

/**
 * The sheet is about to ask on its own, this visit: a phone's browser, not installed, not quieted, not on a quiet page.
 * The getting-started welcome waits for it (ADR 0088), so installing comes first.
 */
export function installAskComing(path: string): boolean {
  return (
    !askedThisVisit() &&
    !wasInstalled() &&
    !dismissedRecently(INSTALL_DISMISSED, INSTALL_QUIET_DAYS) &&
    !quietForInstall(path, routing.locales) &&
    deviceWay() !== "none"
  );
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
 * Anyone on a phone's browser (ADR 0085, ADR 0088): a sheet asks them to put Mystonie on their home screen, where it
 * opens full screen like an app. Visitors a few seconds into their visit, before any sign-up; signed-in people almost
 * at once, before the getting-started welcome. Chromium gets an Install button (its own dialog), iOS the Share → Add to
 * Home Screen → Open as Web App steps, other Android browsers their menu, and an app's own browser (Instagram, LINE…)
 * how to open the page in the real one. Once a visit; one "Not now" quiets it and Home's install card for 24 hours.
 *
 * Anyone can also ask for it (`askToInstall()`, the getting-started checklist's step, ADR 0088): the browser's dialog
 * at once when it's ready, otherwise this sheet with this browser's steps (a computer's too) and "It's on my home
 * screen", which ticks the step. Asking never counts as "Not now".
 */
export function InstallSheet() {
  const t = useTranslations("Install");
  const pathname = usePathname();
  const ready = useSyncExternalStore(subscribeInstall, installPromptReady, () => false);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [requested, setRequested] = useState(false);
  const [copied, setCopied] = useState(false);
  // Chrome may offer its dialog only after the sheet opened: then the steps become the Install button.
  const way: Asked | null = asked && ready ? "prompt" : asked;

  useEffect(() => {
    if (asked) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (!installAskComing(pathname)) return;
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
    timer = setTimeout(check, signedIn() ? SIGNED_IN_DELAY_MS : DELAY_MS);
    return () => clearTimeout(timer);
    // `ready`: Chrome's offer can come after the first look, and it clears an out-of-date "installed".
  }, [pathname, asked, ready]);

  // Asked for: still inside the tap, so the browser's own dialog may open straight away.
  useEffect(
    () =>
      onAskToInstall(() => {
        const found = askedInstallWay({
          ua: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
          standalone: isStandalone(),
          promptReady: installPromptReady(),
        });
        if (found === "none") return;
        rememberAsked();
        track("install_prompt", { action: "shown", way: found, requested: true });
        if (found === "prompt") {
          void promptInstall().then((accepted) => {
            if (accepted) markInstalled();
            track("install_prompt", { action: accepted ? "installed" : "dismissed", way: found, requested: true });
          });
          return;
        }
        setCopied(false);
        setRequested(true);
        setAsked(found);
      }),
    [],
  );

  function close(action: "dismissed" | "installed") {
    if (!way) return;
    if (action === "installed") markInstalled();
    else if (!requested) rememberDismissed(INSTALL_DISMISSED);
    track("install_prompt", requested ? { action, way, requested } : { action, way });
    setAsked(null);
    setRequested(false);
  }

  // After the steps they say when it's done (iOS's home-screen app keeps its own storage, so Safari can't see it), which
  // ticks the checklist and hides Home's card; an app's browser can't install, so there it's only "Got it".
  const confirm = way === "ios" || way === "menu" || way === "desktop";

  return (
    <Sheet open={way !== null} onClose={() => close("dismissed")} title={way === "desktop" ? t("desktopTitle") : t("title")} closeLabel={t("close")}>
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
        <p className="text-muted-foreground">
          {way === "in_app" ? t("inAppBody") : way === "desktop" ? t("desktopBody", { site: window.location.host }) : t("body")}
        </p>

        {way === "ios" && (
          <Steps>
            <Step icon={<ShareIcon />}>{t("iosShare")}</Step>
            <Step icon={<SquarePlusIcon />}>{t("iosAdd")}</Step>
            <Step icon={<SmartphoneIcon />}>{t("iosWebApp")}</Step>
          </Steps>
        )}
        {/* iOS gives the home-screen app its own storage: someone signed in here signs in there once more. */}
        {way === "ios" && signedIn() && <p className="text-sm text-muted-foreground">{t("iosSignIn")}</p>}
        {way === "menu" && (
          <Steps>
            <Step icon={<EllipsisVerticalIcon />}>{t("menuOpen")}</Step>
            <Step icon={<SquarePlusIcon />}>{t("menuAdd")}</Step>
          </Steps>
        )}
        {way === "desktop" && (
          <Steps>
            <Step icon={<MonitorDownIcon />}>{t("desktopChrome")}</Step>
            <Step icon={<AppWindowMacIcon />}>{t("desktopSafari")}</Step>
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
          {confirm && (
            <button
              type="button"
              onClick={() => close("installed")}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
            >
              <CheckIcon className="size-5" aria-hidden="true" />
              {way === "desktop" ? t("installedDesktop") : t("installed")}
            </button>
          )}
          <button type="button" onClick={() => close("dismissed")} className="h-12 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press">
            {way === "prompt" || confirm ? t("notNow") : t("done")}
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
