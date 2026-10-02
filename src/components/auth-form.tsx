"use client";

import type { AuthError } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath } from "@/core/auth";
import type { OAuthProvider } from "@/core/avatar";
import { EMAIL_MAX, isValidEmail, normalizeEmail } from "@/core/waitlist";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { browserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type Notice = "invalidEmail" | "invalidCode" | "rateLimited" | "error" | "unavailable" | "resent" | "errorLink" | "errorOauth";
type Busy = OAuthProvider | "send" | "verify" | null;

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
const primary = "h-12 w-full rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press";

/**
 * Passwordless sign-in (ADR 0020): a social account (Google, Apple, Facebook, X, Discord: ADR 0064, ADR 0071) for each
 * provider switched on, or an emailed code. The code is typed here, which also works in an
 * installed PWA (where a tapped email link would open the browser instead); the email's link is for people
 * reading it on the same device. New and returning people take the same path.
 */
export function AuthForm({ next, providers, initialError }: { next: string; providers: readonly OAuthProvider[]; initialError: "link" | "oauth" | null }) {
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

  async function withProvider(provider: OAuthProvider) {
    const supabase = browserClient();
    if (!supabase) return setNotice("unavailable");
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?${new URLSearchParams({ next, tz: timeZone() })}`,
        // Facebook: the name, email and photo only (`public_profile` comes with every login). Apple, X and Discord's
        // defaults in Supabase already ask for the name and email.
        ...(provider === "facebook" ? { scopes: "email" } : {}),
      },
    });
    // On success the browser is already leaving for the provider.
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
      {providers.length > 0 && (
        <>
          {providers.map((provider) => {
            const { Mark, className } = BRAND[provider];
            return (
              <button
                key={provider}
                type="button"
                onClick={() => withProvider(provider)}
                disabled={busy !== null}
                className={cn("flex h-12 w-full items-center justify-center gap-3 rounded-full font-semibold disabled:opacity-60 press", className)}
              >
                <Mark />
                {t(provider)}
              </button>
            );
          })}
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

/** Each provider's button, in its own brand's colours (their sign-in guidelines ask for the official mark). */
const BRAND: Record<OAuthProvider, { Mark: () => ReactElement; className: string }> = {
  google: { Mark: GoogleMark, className: "bg-background ring-1 ring-input hover:bg-muted" },
  apple: { Mark: AppleMark, className: "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85" },
  facebook: { Mark: FacebookMark, className: "bg-[#1877f2] text-white hover:bg-[#166fe5]" },
  twitter: { Mark: XMark, className: "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85" },
  discord: { Mark: DiscordMark, className: "bg-[#5865f2] text-white hover:bg-[#4752c4]" },
};

/** Apple's logo, in the button's text colour (black on white, or white on black). */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.37 12.75c-.02-2.33 1.9-3.45 1.99-3.5-1.08-1.59-2.77-1.8-3.37-1.83-1.43-.15-2.8.84-3.53.84-.73 0-1.85-.82-3.04-.8-1.56.03-3 .91-3.81 2.31-1.62 2.82-.41 7 1.17 9.29.77 1.12 1.69 2.38 2.9 2.33 1.17-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.73 1.25-.02 2.04-1.14 2.81-2.27.88-1.3 1.25-2.56 1.27-2.62-.03-.01-2.44-.94-2.46-3.73M14.07 5.9c.64-.78 1.08-1.86.96-2.94-.93.04-2.05.62-2.72 1.4-.6.69-1.12 1.79-.98 2.85 1.04.08 2.1-.53 2.74-1.31"
      />
    </svg>
  );
}

/** X's logo, in the button's text colour. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"
      />
    </svg>
  );
}

/** Discord's logo: white on its blurple button. */
function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.64 12.64 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03M8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42m7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42"
      />
    </svg>
  );
}

/** Facebook's "f" logo: white on its blue button, as its brand guidelines ask. */
function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07"
      />
    </svg>
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
