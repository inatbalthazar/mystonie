"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

// Google Identity Services, loaded from Google on the sign-in page only (ADR 0073). Typed here: no package.
type CredentialResponse = { credential?: string };
type Gsi = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        nonce: string;
        ux_mode: "popup";
        use_fedcm_for_button: boolean;
        context: "use";
        itp_support: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline" | "filled_black";
          size: "large";
          shape: "pill";
          text: "continue_with";
          logo_alignment: "center";
          width: number;
          locale: string;
        },
      ): void;
    };
  };
};

const SCRIPT = "https://accounts.google.com/gsi/client";
/** If Google's script hasn't drawn its button by then (blocked, offline), the redirect button stands in. */
const LOAD_MS = 6000;

let loading: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  loading ??= new Promise<Gsi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const gsi = (window as unknown as { google?: Gsi }).google;
      if (gsi) resolve(gsi);
      else reject(new Error("no google.accounts"));
    };
    script.onerror = () => reject(new Error("Google's script didn't load"));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const dark = () => {
  const theme = document.documentElement.dataset.theme;
  return (
    theme === "dark" ||
    (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
  );
};

/**
 * "Continue with Google" drawn by Google itself (ADR 0073), so its account chooser says "to continue to
 * mystonie.com", our own domain, instead of the Supabase project's: the ID token it gives is exchanged for a
 * session in the browser (`signInWithIdToken`, with a nonce), then `/api/auth/finish` does what the OAuth callback
 * does. While Google's script loads, and if it can't, `fallback` (the redirect button) shows instead.
 */
export function GoogleButton({
  clientId,
  next,
  timeZone,
  fallback,
  onStart,
  onError,
}: {
  clientId: string;
  next: string;
  timeZone: () => string;
  fallback: ReactNode;
  onStart: () => void;
  onError: (rateLimited: boolean) => void;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // The latest callbacks, for Google's callback that was set up once.
  const handlers = useRef({ next, timeZone, onStart, onError });
  useEffect(() => {
    handlers.current = { next, timeZone, onStart, onError };
  });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => !cancelled && setState((s) => (s === "loading" ? "failed" : s)),
      LOAD_MS,
    );
    (async () => {
      const nonce = crypto.randomUUID();
      const [gsi, hashed] = await Promise.all([loadGsi(), sha256Hex(nonce)]);
      const el = ref.current;
      if (cancelled || !el) return;
      gsi.accounts.id.initialize({
        client_id: clientId,
        // Google signs the hashed nonce into the token; Supabase checks it against the raw one.
        nonce: hashed,
        ux_mode: "popup",
        use_fedcm_for_button: true,
        context: "use",
        itp_support: true,
        callback: async ({ credential }) => {
          const h = handlers.current;
          const supabase = browserClient();
          if (!credential || !supabase) return h.onError(false);
          h.onStart();
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce,
          });
          if (error) return h.onError(error.status === 429);
          await fetch("/api/auth/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ next: h.next, tz: h.timeZone() }),
          }).catch(() => {}); // the locale and photo are a nicety: sign-in has already worked
          // A full navigation, so the server renders the next page with the new session cookie.
          window.location.assign(h.next);
        },
      });
      gsi.accounts.id.renderButton(el, {
        type: "standard",
        theme: dark() ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        width: Math.min(
          400,
          Math.max(200, Math.round(el.getBoundingClientRect().width)),
        ),
        locale,
      });
      setState("ready");
    })().catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientId, locale]);

  return (
    <div className="relative">
      {state !== "ready" && fallback}
      {/* Google's button draws itself in here; laid out at full width while hidden, so it can be measured. Its
          iframe's page has no dark scheme: under ours (`color-scheme: dark`) the browser paints an opaque white box
          behind it, so this box keeps the light scheme and the iframe stays see-through. Same height as the other
          buttons (h-12), so the row lines up. */}
      <div
        ref={ref}
        className={cn(
          "[color-scheme:light]",
          state === "ready"
            ? "flex min-h-12 items-center justify-center"
            : "invisible absolute inset-x-0 top-0 h-0 overflow-hidden",
        )}
      />
    </div>
  );
}
