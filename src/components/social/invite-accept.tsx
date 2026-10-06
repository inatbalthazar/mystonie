"use client";

import { PartyPopperIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { INVITE_KEY, storedInvite } from "@/core/invites";
import { track } from "@/lib/analytics";

/** The inviter's name between accepting and showing it, in case the page reloads in between. */
const ACCEPTED_KEY = "mystonie.inviteAccepted";

function forget() {
  try {
    window.localStorage.removeItem(INVITE_KEY);
  } catch {
    // storage blocked: nothing was remembered either
  }
}

/**
 * The invite this device came from (`/join/<username>`, ADR 0098), accepted once an account is signed in: the server
 * makes the two follow each other (new accounts only) and this says so. The invite is forgotten either way.
 */
export function InviteAccept() {
  const t = useTranslations("Social");
  const [inviter, setInviter] = useState<string | null>(null);

  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-auth")) return;
    // Accepted just before the page reloaded (signing in can): say so now.
    try {
      const shown = window.sessionStorage.getItem(ACCEPTED_KEY);
      if (shown) {
        window.sessionStorage.removeItem(ACCEPTED_KEY);
        // After hydration's render, never during it.
        setTimeout(() => setInviter(shown), 0);
      }
    } catch {
      // storage blocked
    }
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(INVITE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    const username = storedInvite(raw, Date.now());
    if (!username) return forget();
    void fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) })
      .then(async (response) => {
        // Signed out after all, or the server can't now: try again on a later page.
        if (response.status === 401 || response.status >= 500 || response.status === 429) return;
        forget();
        const body = (await response.json().catch(() => null)) as { inviter?: { username: string; displayName: string | null } | null } | null;
        if (!body?.inviter) return;
        const name = body.inviter.displayName || `@${body.inviter.username}`;
        try {
          window.sessionStorage.setItem(ACCEPTED_KEY, name);
        } catch {
          // storage blocked: shown only if this page stays
        }
        setInviter(name);
        track("invite_accepted", {});
      })
      .catch(() => {});
  }, []);

  // Once it's been on screen a moment, a later page needn't say it again.
  useEffect(() => {
    if (!inviter) return;
    const timer = setTimeout(() => {
      try {
        window.sessionStorage.removeItem(ACCEPTED_KEY);
      } catch {
        // storage blocked
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [inviter]);

  if (!inviter) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--island-space,6rem)+0.5rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-card p-3 pl-4 shadow-lg ring-1 ring-border"
    >
      <PartyPopperIcon className="size-6 shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">{t.rich("inviteAccepted", { name: inviter, b: (chunks) => <strong className="font-semibold">{chunks}</strong> })}</p>
      <button
        type="button"
        onClick={() => {
          setInviter(null);
          try {
            window.sessionStorage.removeItem(ACCEPTED_KEY);
          } catch {
            // storage blocked
          }
        }}
        aria-label={t("inviteAcceptedClose")}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <XIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
