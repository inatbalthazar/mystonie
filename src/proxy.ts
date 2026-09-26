import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Resolves the locale from the URL prefix (none = en) and rewrites to /[locale].
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension (favicon.ico, images, …).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
