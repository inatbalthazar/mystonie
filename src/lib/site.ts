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
