"use client";

import { SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { askedInstallWay } from "@/core/install";
import {
  askToInstall,
  dismissedRecently,
  INSTALL_DISMISSED as DISMISSED,
  INSTALL_QUIET_DAYS,
  installPromptReady,
  isStandalone,
  markInstalled,
  promptInstall,
  rememberDismissed,
  subscribeInstall,
  wasInstalled,
} from "./browser";

const noSubscribe = () => () => {};

/** A phone (or tablet) whose browser installs only by hand: iOS, an Android menu, or an app's browser. */
const handPhone = () => {
  const way = askedInstallWay({
    ua: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: false,
    promptReady: false,
  });
  return way === "ios" || way === "menu" || way === "in_app";
};

/**
 * Home: "Keep Mystonie on your home screen" (ADR 0028). Chromium gets an Install button (its own dialog); other phones
 * "Show me how", which opens the install sheet with their browser's steps (ADR 0088). Hidden in the installed app,
 * once it's been installed here, and for a week after "Not now".
 */
export function InstallPrompt() {
  const t = useTranslations("HomeApp");
  const ready = useSyncExternalStore(subscribeInstall, installPromptReady, () => false);
  const blocked = useSyncExternalStore(
    subscribeInstall,
    () => isStandalone() || wasInstalled() || dismissedRecently(DISMISSED, INSTALL_QUIET_DAYS),
    () => true,
  );
  const phone = useSyncExternalStore(noSubscribe, handPhone, () => false);
  const [hidden, setHidden] = useState(false);
  if (blocked || hidden || !(ready || phone)) return null;

  return (
    <aside
      aria-labelledby="install-title"
      className="relative flex -rotate-[0.5deg] flex-col gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-4 pt-5 dark:bg-brand/10"
    >
      <span aria-hidden="true" className="absolute -top-3 left-8 h-6 w-16 -rotate-[4deg] rounded-[2px] bg-card/90 shadow-sm ring-1 ring-border" />
      <p id="install-title" className="flex items-center gap-2 font-semibold">
        <SmartphoneIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
        {t("installTitle")}
      </p>
      <p className="text-sm text-muted-foreground">{t("installBody")}</p>
      <div className="flex gap-2">
        {ready ? (
          <button
            type="button"
            onClick={async () => {
              if (await promptInstall()) {
                markInstalled();
                setHidden(true);
              }
            }}
            className="h-11 rounded-full bg-brand px-4 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            {t("install")}
          </button>
        ) : (
          <button
            type="button"
            onClick={askToInstall}
            className="h-11 rounded-full bg-brand px-4 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            {t("installHow")}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            rememberDismissed(DISMISSED);
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
