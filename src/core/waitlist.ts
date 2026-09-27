// Waitlist sign-up validation, shared by the route handler (authoritative) and the form.

export const EMAIL_MAX = 320;
const SOURCE_MAX = 200;

/** Deliberately loose: one @, a dot in the domain, no spaces. The confirmation email is the real check. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

export type WaitlistSignup = { email: string; locale: string; source: string | null };

export type WaitlistParse =
  | { kind: "ok"; signup: WaitlistSignup }
  /** Honeypot filled: answer as if it worked, store nothing. */
  | { kind: "bot" }
  | { kind: "invalid" };

/** Validates a POST body `{ email, locale, source, website }` (`website` is the honeypot). */
export function parseWaitlistBody(body: unknown, locales: readonly string[], defaultLocale: string): WaitlistParse {
  if (typeof body !== "object" || body === null) return { kind: "invalid" };
  const b = body as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim() !== "") return { kind: "bot" };
  if (typeof b.email !== "string") return { kind: "invalid" };

  const email = normalizeEmail(b.email);
  if (!isValidEmail(email)) return { kind: "invalid" };

  const locale = typeof b.locale === "string" && locales.includes(b.locale) ? b.locale : defaultLocale;
  const source = typeof b.source === "string" && b.source.trim() ? b.source.trim().slice(0, SOURCE_MAX) : null;
  return { kind: "ok", signup: { email, locale, source } };
}

/**
 * Where a sign-up came from, as a compact query string for `waitlist.source`:
 * the form placement plus the landing attribution (`ref`, `tpl`, `utm_*`), e.g.
 * `placement=after_card&ref=card&tpl=polaroid`.
 */
export function waitlistSource(placement: string, landingSearch: string): string {
  const landing = new URLSearchParams(landingSearch);
  const out = new URLSearchParams({ placement });
  for (const key of ["ref", "tpl", "utm_source", "utm_medium", "utm_campaign"]) {
    const value = landing.get(key)?.slice(0, 40);
    if (value) out.set(key, value);
  }
  return out.toString();
}
