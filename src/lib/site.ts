type SiteEnv = Partial<Record<"NEXT_PUBLIC_SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL", string>>;

/**
 * Absolute origin of the site, used for `metadataBase`, robots and sitemap.
 * `NEXT_PUBLIC_SITE_URL` (the custom domain, once bought) wins, then Vercel's
 * production domain (set automatically on Vercel), then local dev.
 */
export function siteUrl(
  env: SiteEnv = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  },
): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

/**
 * Mystonie is in beta (ADR 0055): the BETA stamp by the logo, the beta notes in the footer, Settings and /feedback.
 * Set to false at launch.
 */
export const BETA = true;

/** The owner's tip page (Buy Me a Coffee, ADR 0049): the footer and Settings link to it. Tips unlock nothing. */
export const SUPPORT_URL = "https://buymeacoffee.com/inatbalthab";
