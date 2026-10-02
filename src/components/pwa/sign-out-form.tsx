"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { clearOfflineData, useUnsyncedCount } from "../offline/offline-data";
import { pushEndpointForSignOut } from "./push";

/**
 * Settings → "Sign out": a plain form post, plus this device's push subscription so the server drops it too. What the
 * app kept on this device goes first (S3 offline); changes that haven't synced yet take a second tap.
 */
export function SignOutForm({ next }: { next: string }) {
  const t = useTranslations("Settings");
  const offline = useTranslations("Offline");
  const endpoint = useRef<HTMLInputElement>(null);
  const unsynced = useUnsyncedCount();
  const [confirming, setConfirming] = useState(false);
  return (
    <form
      action="/api/auth/sign-out"
      method="post"
      className="mt-4 flex flex-col items-start gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (unsynced > 0 && !confirming) return setConfirming(true);
        const [pushEndpoint] = await Promise.all([pushEndpointForSignOut(), clearOfflineData().catch(() => {})]);
        // Set right before submitting: clearing re-renders this form.
        if (pushEndpoint && endpoint.current) endpoint.current.value = pushEndpoint;
        form.submit();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <input ref={endpoint} type="hidden" name="push_endpoint" />
      {confirming && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {offline("signOutWaiting", { count: unsynced })}
        </p>
      )}
      <button type="submit" className="h-11 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press">
        {confirming ? offline("signOutAnyway") : t("signOut")}
      </button>
    </form>
  );
}
