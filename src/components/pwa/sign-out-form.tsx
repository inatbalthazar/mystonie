"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { pushEndpointForSignOut } from "./push";

/** Settings → "Sign out": a plain form post, plus this device's push subscription so the server drops it too. */
export function SignOutForm({ next }: { next: string }) {
  const t = useTranslations("Settings");
  const endpoint = useRef<HTMLInputElement>(null);
  return (
    <form
      action="/api/auth/sign-out"
      method="post"
      className="mt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const pushEndpoint = await pushEndpointForSignOut();
        if (pushEndpoint && endpoint.current) endpoint.current.value = pushEndpoint;
        form.submit();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <input ref={endpoint} type="hidden" name="push_endpoint" defaultValue="" />
      <button type="submit" className="h-11 rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted">
        {t("signOut")}
      </button>
    </form>
  );
}
