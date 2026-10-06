"use client";

import { Share2Icon, UserPlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { localizedPath } from "@/core/auth";
import { invitePath } from "@/core/invites";
import { routing } from "@/i18n/routing";
import { track } from "@/lib/analytics";

/**
 * "Invite friends" (ADR 0098): your invite link, through the phone's share sheet or copied. A friend who joins from it
 * and you follow each other, and you get the Plus One sticker.
 */
export function InviteCard({ username, place }: { username: string; place: "people" | "me" | "join" }) {
  const t = useTranslations("Social");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(localizedPath(invitePath(username), locale, routing.defaultLocale), window.location.origin).href;
    try {
      if (navigator.share) {
        await navigator.share({ text: t("inviteShareText"), url });
        track("invite_shared", { channel: "share_sheet", place });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("invite_shared", { channel: "copy", place });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No share sheet and no clipboard: nothing more to try.
    }
  }

  return (
    <section aria-labelledby="invite" className="relative flex flex-col gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-4 dark:bg-brand/10">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 rotate-[-6deg] items-center justify-center rounded-xl bg-card text-brand shadow-sm ring-1 ring-brand/20">
          <UserPlusIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="invite" className="font-display text-lg font-extrabold">
            {t("inviteTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("inviteBody")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={share}
        className="flex h-11 items-center justify-center gap-2 self-start rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
      >
        <Share2Icon className="size-4" aria-hidden="true" />
        {t("inviteButton")}
      </button>
      <p aria-live="polite" className="text-sm font-semibold text-brand empty:hidden">
        {copied ? t("inviteCopied") : ""}
      </p>
    </section>
  );
}
