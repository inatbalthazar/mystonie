// Resend (ADR 0019), called with fetch: no SDK. Server only; the API key never reaches the browser.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
};

export class EmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type EmailConfig = { apiKey: string; from: string; replyTo?: string };

/** Null when sending isn't configured (development without keys). */
export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined };
}

/** Resend accepts up to 100 emails per batch call. */
export const BATCH_MAX = 100;

/**
 * Sends up to 100 emails in one call. The idempotency key makes a retried call (same key within 24 h)
 * a no-op on Resend's side instead of a second send.
 */
export async function sendEmailBatch(config: EmailConfig, emails: OutgoingEmail[], idempotencyKey: string): Promise<void> {
  if (emails.length === 0) return;
  if (emails.length > BATCH_MAX) throw new EmailError(`batch of ${emails.length} is over ${BATCH_MAX}`, 400);
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify(emails.map((e) => ({ from: config.from, reply_to: config.replyTo, ...e, to: [e.to] }))),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    // Resend errors are `{ name, message }` and never echo the key.
    const detail = await response.text().catch(() => "");
    throw new EmailError(`Resend ${response.status}: ${detail.slice(0, 300)}`, response.status);
  }
}

/** Sends one email (auth emails; they must go out right away, one at a time). */
export async function sendEmail(config: EmailConfig, email: OutgoingEmail, idempotencyKey?: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from: config.from, reply_to: config.replyTo, ...email, to: [email.to] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new EmailError(`Resend ${response.status}: ${detail.slice(0, 300)}`, response.status);
  }
}

/**
 * Development only, without a Resend key: hands the email to the local Supabase Mailpit inbox
 * (http://127.0.0.1:54324) through its send API, so sign-in works offline and nothing reaches real inboxes.
 */
export async function sendToLocalInbox(email: OutgoingEmail): Promise<void> {
  const base = process.env.MAILPIT_URL?.trim() || "http://127.0.0.1:54324";
  const response = await fetch(`${base}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: "hello@mystonie.local", Name: "Mystonie" },
      To: [{ Email: email.to }],
      Subject: email.subject,
      HTML: email.html,
      Text: email.text,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new EmailError(`Mailpit ${response.status}`, response.status);
}
