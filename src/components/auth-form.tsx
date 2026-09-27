"use client";

import type { AuthError } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath } from "@/core/auth";
import { EMAIL_MAX, isValidEmail, normalizeEmail } from "@/core/waitlist";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { browserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type Notice = "invalidEmail" | "invalidCode" | "rateLimited" | "error" | "unavailable" | "resent" | "errorLink" | "errorOauth";
type Busy = "google" | "send" | "verify" | null;

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function noticeFor(error: AuthError, fallback: Notice): Notice {
  if (error.status === 429 || error.code?.startsWith("over_")) return "rateLimited";
  return fallback;
}

const input =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-destructive";
const primary = "h-12 w-full rounded-xl bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60";

/**
 * Passwordless sign-in (ADR 0020): Google, or an emailed code. The code is typed here, which also works in an
 * installed PWA (where a tapped email link would open the browser instead); the email's link is for people
 * reading it on the same device. New and returning people take the same path.
 */
export function AuthForm({ next, google, initialError }: { next: string; google: boolean; initialError: "link" | "oauth" | null }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(
    initialError === "link" ? "errorLink" : initialError === "oauth" ? "errorOauth" : null,
  );

  async function withGoogle() {
    const supabase = browserClient();
    if (!supabase) return setNotice("unavailable");
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback?${new URLSearchParams({ next, tz: timeZone() })}` },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setBusy(null);
      setNotice(noticeFor(error, "error"));
    }
  }

  async function sendCode(address: string) {
    const supabase = browserClient();
    if (!supabase) return setNotice("unavailable");
    setBusy("send");
    const confirm = `${window.location.origin}${localizedPath("/auth/confirm", locale, routing.defaultLocale)}?${new URLSearchParams({ next })}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: confirm,
        // Read once by the profiles trigger when this creates the account.
        data: { signup_locale: locale, signup_time_zone: timeZone() },
      },
    });
    setBusy(null);
    if (error) return setNotice(noticeFor(error, "error"));
    setNotice(sentTo ? "resent" : null);
    setSentTo(address);
  }

  async function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) return setNotice("invalidEmail");
    await sendCode(address);
  }

  async function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = browserClient();
    if (!supabase || !sentTo) return setNotice("unavailable");
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setNotice("invalidCode");
    setBusy("verify");
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token, type: "email" });
    if (error) {
      setBusy(null);
      return setNotice(noticeFor(error, "invalidCode"));
    }
    // Drop a previous account's saved language/theme; the proxy loads this account's on the next request.
    document.cookie = `${PREFS_COOKIE}=; Max-Age=0; Path=/`;
    // A full navigation, so the server renders the next page with the new session cookie.
    window.location.assign(next);
  }

  const noticeText = notice && (
    <p
      id={`${id}-notice`}
      role={notice === "resent" ? "status" : "alert"}
      className={cn("text-sm", notice === "resent" ? "text-muted-foreground" : "text-destructive")}
    >
      {t(notice)}
    </p>
  );

  if (sentTo) {
    return (
      <form onSubmit={submitCode} noValidate className="flex flex-col gap-4">
        <p className="leading-relaxed">{t("codeSent", { email: sentTo })}</p>
        <label htmlFor={`${id}-code`} className="text-sm font-semibold">
          {t("codeLabel")}
        </label>
        <input
          id={`${id}-code`}
          name="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 10));
            if (notice === "invalidCode") setNotice(null);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          autoFocus
          aria-invalid={notice === "invalidCode"}
          aria-describedby={notice ? `${id}-notice` : undefined}
          className={cn(input, "text-center font-display text-2xl font-bold tracking-[0.4em]")}
        />
        {noticeText}
        <button type="submit" disabled={busy !== null} className={primary}>
          {busy === "verify" ? t("verifying") : t("verify")}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" disabled={busy !== null} onClick={() => sendCode(sentTo)} className="min-h-11 font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60">
            {busy === "send" ? t("sending") : t("resend")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setCode("");
              setNotice(null);
            }}
            className="min-h-11 text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("changeEmail")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {google && (
        <>
          <button
            type="button"
            onClick={withGoogle}
            disabled={busy !== null}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-background font-semibold ring-1 ring-input hover:bg-muted disabled:opacity-60"
          >
            <GoogleMark />
            {t("google")}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submitEmail} noValidate className="flex flex-col gap-3">
        <label htmlFor={`${id}-email`} className="text-sm font-semibold">
          {t("emailLabel")}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (notice === "invalidEmail") setNotice(null);
          }}
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          inputMode="email"
          maxLength={EMAIL_MAX}
          required
          aria-invalid={notice === "invalidEmail"}
          aria-describedby={notice ? `${id}-notice` : undefined}
          className={input}
        />
        {noticeText}
        <button type="submit" disabled={busy !== null} className={primary}>
          {busy === "send" ? t("sending") : t("sendCode")}
        </button>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.rich("terms", {
          terms: (chunks) => (
            <Link href="/terms" className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}

/** Google's "G" in its brand colours (their sign-in button guidelines ask for the official mark). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
