// Product analytics events (PostHog). The names are the S0 spec's contract: dashboards depend on them.

export type AnalyticsEvents = {
  /** A card preview was made: a picked title (card maker) or a celebration (`card`: finish / progress). */
  card_created: { kind: string; tpl: string; card?: string };
  template_switched: { tpl: string; via: "button" | "swipe" };
  size_switched: { size: string };
  /** `channel`: the share sheet, or the copied `/c/[id]` link (desktop). `card`: finish / progress / sticker. */
  card_shared: { tpl: string; size: string; channel?: "share_sheet" | "link"; card?: string };
  /** `fallback`: Share wasn't possible, so the file was saved instead. */
  card_downloaded: { tpl: string; size: string; fallback: boolean; card?: string };
  /** A new account whose visit started on a shared card page (`/c/[id]`). */
  signup_from_card: { tpl?: string };
  waitlist_joined: { placement: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Share-link attribution from the landing URL (`?ref=card&tpl=polaroid`), added to every event. */
export type Attribution = { ref?: string; tpl?: string };

const ATTRIBUTION_KEYS = ["ref", "tpl"] as const;
const VALUE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function landingAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    // Only short slugs: anything else is noise (or someone pasting data into the URL).
    if (value && VALUE_RE.test(value)) out[key] = value;
  }
  return out;
}

/** PostHog API host → its web app host (`https://eu.i.posthog.com` → `https://eu.posthog.com`). */
export function posthogUiHost(apiHost: string): string {
  return apiHost.replace("://eu.i.", "://eu.").replace("://us.i.", "://us.");
}

/** PostHog API host → its static assets host (`https://eu.i.posthog.com` → `https://eu-assets.i.posthog.com`). */
export function posthogAssetsHost(apiHost: string): string {
  return apiHost.replace(/:\/\/(eu|us)\.i\./, "://$1-assets.i.");
}
