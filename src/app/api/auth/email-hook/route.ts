import { hasLocale, type Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { splitLocale } from "@/core/auth";
import { isSignInAction, signInEmail, signInLink, type SignInCopy } from "@/core/email/sign-in";
import { verifyWebhook } from "@/core/email/webhook";
import { emailConfig, sendEmail, sendToLocalInbox } from "@/data/email";
import { routing } from "@/i18n/routing";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const COPY_KEYS = ["subject", "preheader", "stamp", "heading", "body", "cta", "expiry", "ignore"] as const;

type HookPayload = {
  user?: { id?: string; email?: string; user_metadata?: { signup_locale?: unknown } };
  email_data?: { token?: string; token_hash?: string; redirect_to?: string; email_action_type?: string };
};

/** Supabase Auth reads `{ error: { http_code, message } }` and shows the message to the caller. */
function hookError(status: number, message: string): Response {
  return Response.json({ error: { http_code: status, message } }, { status });
}

/** The page locale the person signed in from (the confirm page path), then their sign-up locale. */
function emailLocale(redirectTo: string | undefined, signupLocale: unknown): Locale {
  try {
    if (redirectTo) {
      const { locale } = splitLocale(new URL(redirectTo).pathname, routing.locales, routing.defaultLocale);
      if (locale !== routing.defaultLocale && hasLocale(routing.locales, locale)) return locale;
    }
  } catch {}
  return typeof signupLocale === "string" && hasLocale(routing.locales, signupLocale) ? signupLocale : routing.defaultLocale;
}

/**
 * POST /api/auth/email-hook: Supabase Auth's Send Email Hook (ADR 0020). Supabase signs the request
 * (Standard Webhooks, `SEND_EMAIL_HOOK_SECRET`); we render the sign-in email from messages/*.json in the
 * person's locale and send it with Resend. In development without a Resend key it goes to Mailpit.
 */
export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return hookError(503, "email hook is not configured");

  const body = await request.text();
  const signed = await verifyWebhook(
    secret,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    body,
  );
  if (!signed) return hookError(401, "invalid signature");

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return hookError(400, "invalid payload");
  }
  const { user, email_data: data } = payload;
  const action = data?.email_action_type ?? "";
  const token = data?.token;
  if (!user?.email || !token || !data.token_hash) return hookError(400, "invalid payload");
  if (!isSignInAction(action)) {
    // We only use passwordless sign-in. Anything else (email change, recovery, notifications) isn't
    // switched on; log it rather than failing the auth call.
    console.warn(`email hook: ignored email_action_type "${action}"`);
    return Response.json({});
  }

  const site = siteUrl();
  const locale = emailLocale(data.redirect_to, user.user_metadata?.signup_locale);
  const t = await getTranslations({ locale, namespace: "Emails.signIn" });
  const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, k === "subject" ? t(k, { code: token }) : t(k)])) as SignInCopy;
  const confirmPage = new URL(locale === routing.defaultLocale ? "/auth/confirm" : `/${locale}/auth/confirm`, site);
  const email = {
    to: user.email,
    ...signInEmail(
      copy,
      {
        code: token,
        link: signInLink(data.redirect_to ?? "", confirmPage, data.token_hash, action),
        logo: new URL("/apple-icon", site).toString(),
        sender: `Mystonie · ${new URL(LEGAL.operatorSite).host.replace(/^www\./, "")}`,
      },
      locale,
    ),
    tags: [{ name: "category", value: "sign_in" }],
  };

  try {
    const config = emailConfig();
    if (config) {
      // Supabase retries a failed hook with the same webhook-id: don't send twice.
      await sendEmail(config, email, `auth:${request.headers.get("webhook-id")}`);
    } else if (process.env.NODE_ENV === "development") {
      await sendToLocalInbox(email);
    } else {
      return hookError(503, "email sending is not configured");
    }
    return Response.json({});
  } catch (error) {
    console.error("sign-in email failed", error);
    return hookError(502, "could not send the email");
  }
}
