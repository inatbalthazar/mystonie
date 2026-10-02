"use client";

import { ShareIcon, SmartphoneIcon, SquarePlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { dismissedRecently, INSTALL_DISMISSED as DISMISSED, installPromptReady, isIos, isStandalone, promptInstall, rememberDismissed, subscribeInstall } from "./browser";

const noSubscribe = () => () => {};

/** How this browser installs: its own dialog (Chromium), the Share sheet (iOS Safari), or not at all here. */
type Way = "none" | "prompt" | "ios";

/**
 * Home: "Keep Mystonie on your home screen" (ADR 0028). Chromium gets an Install button (its own dialog), iOS
 * Safari the Share → Add to Home Screen steps. Hidden in the installed app, where nothing else offers install,
 * and for 30 days after "Not now".
 */
export function InstallPrompt() {
  const t = useTranslations("HomeApp");
  const ready = useSyncExternalStore(subscribeInstall, installPromptReady, () => false);
  const blocked = useSyncExternalStore(noSubscribe, () => isStandalone() || dismissedRecently(DISMISSED), () => true);
  const ios = useSyncExternalStore(noSubscribe, isIos, () => false);
  const [hidden, setHidden] = useState(false);
  const way: Way = blocked || hidden ? "none" : ready ? "prompt" : ios ? "ios" : "none";
  if (way === "none") return null;

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
      {way === "ios" ? (
        <ol className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <ShareIcon className="size-4 shrink-0" aria-hidden="true" />
            {t("installIosShare")}
          </li>
          <li className="flex items-center gap-2">
            <SquarePlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {t("installIosAdd")}
          </li>
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{t("installBody")}</p>
      )}
      <div className="flex gap-2">
        {way === "prompt" && (
          <button
            type="button"
            onClick={async () => {
              if (await promptInstall()) setHidden(true);
            }}
            className="h-11 rounded-full bg-brand px-4 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            {t("install")}
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
