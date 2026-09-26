import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Resolves the locale from the URL prefix (none = en) and rewrites to /[locale].
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, generated metadata images (served without an extension)
  // and files with an extension (icon.svg, robots.txt, sitemap.xml, …).
  matcher: "/((?!api|_next|_vercel|apple-icon|opengraph-image|.*\\..*).*)",
};
