import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Cormorant_Garamond, Geist, Noto_Sans_Thai, Press_Start_2P } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountLink } from "@/components/account-link";
import { BackButton } from "@/components/back-button";
import { BetaBadge } from "@/components/beta/beta-badge";
import { FeedbackLink } from "@/components/beta/feedback-link";
import { GettingStartedButton } from "@/components/getting-started";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { NavMotion } from "@/components/motion/nav-motion";
import { NavIsland } from "@/components/nav-island";
import { SyncProvider } from "@/components/offline/sync-provider";
import { SyncStatus } from "@/components/offline/sync-status";
import { PwaListener } from "@/components/pwa/browser";
import { PrepaintScript } from "@/components/prepaint-script";
import { RawgAttribution } from "@/components/rawg-attribution";
import { SupportLink } from "@/components/support-link";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { BETA, siteUrl } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Brand display face (headlines, big numbers). The width axis gives condensed numerals on cards.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth"] });

// Handwriting for polaroid captions: only cards use it, so it isn't preloaded. One static weight
// (captions are regular) is ~half the size of the variable font.
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: "400", preload: false });

// The Pro cards' own faces (ADR 0084): a book serif for Gilded and pixel letters for the Arcade. Only those cards use
// them, so they aren't preloaded: nothing downloads until one of those cards is drawn.
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["600", "700"], preload: false });
const pressStart = Press_Start_2P({ variable: "--font-press-start", subsets: ["latin"], weight: "400", preload: false });

// Thai card fallback. Not preloaded: its @font-face rules use unicode-range, so the browser only
// downloads it when a card contains Thai. Korean/Japanese load on demand (src/cards/cjk-fonts.ts).
const notoThai = Noto_Sans_Thai({ variable: "--font-noto-thai", subsets: ["thai"], preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    metadataBase: siteUrl(),
    title: t("title"),
    description: t("description"),
    // Installed on iOS (Add to Home Screen): opens standalone, which also allows notifications (ADR 0028).
    appleWebApp: { capable: true, title: "Mystonie", statusBarStyle: "default" },
  };
}

// Browser chrome matches the page background of each theme (--background in globals.css). The page runs edge to edge
// (`viewport-fit=cover`), so the nav island can sit just above the home indicator (env(safe-area-inset-bottom), ADR 0050).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#161310" },
  ],
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, tb] = await Promise.all([getTranslations({ locale, namespace: "Legal" }), getTranslations({ locale, namespace: "Beta" })]);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${bricolage.variable} ${caveat.variable} ${cormorant.variable} ${pressStart.variable} ${notoThai.variable} h-full antialiased`}
      suppressHydrationWarning // the pre-paint script sets data-theme and data-auth before React hydrates
    >
      <body className="min-h-full flex flex-col">
        <PrepaintScript />
        <PwaListener />
        {/* Which way the next page slides (ADR 0070). */}
        <NavMotion />
        <NextIntlClientProvider>
          <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-4">
            <div className="flex min-w-0 items-center gap-2">
              {/* Under a tab: "‹ Atlas", back to the page before, in place of the logo (ADR 0061). */}
              <BackButton>
                <Logo />
              </BackButton>
              {/* Still in beta (ADR 0055): opens /feedback. */}
              <BetaBadge />
            </div>
            <AccountLink />
          </header>
          {/* Offline-first (S3 offline): the service worker, the outbox, and a note while changes wait on this device. */}
          <SyncProvider />
          <SyncStatus />
          {children}
          {/* Signed out, a website's footer. Signed in, an app's: only the data credits RAWG asks for on every page, clear of
              the getting-started button (pb-20); the language, the legal pages, the beta and the tip link are in Settings
              (ADR 0065). */}
          <footer className="mt-auto flex flex-col items-center gap-4 border-t border-border px-4 pt-8 pb-10 signed-in:border-t-0 signed-in:pt-6 signed-in:pb-20">
            <div className="contents signed-in:hidden">
              <LocaleSwitcher />
              {/* The beta, and "Report a problem" from the page it's on (ADR 0055). */}
              <p className="flex flex-wrap justify-center gap-x-1.5 text-center text-sm text-muted-foreground">
                {BETA && <span>{tb("footer")}</span>}
                <FeedbackLink place="footer" />
              </p>
              <nav className="flex gap-4 text-sm text-muted-foreground">
                <Link href="/privacy" className="underline-offset-4 hover:underline">
                  {t("privacy")}
                </Link>
                <Link href="/terms" className="underline-offset-4 hover:underline">
                  {t("terms")}
                </Link>
              </nav>
              <SupportLink place="footer" />
            </div>
            <div className="flex flex-col items-center gap-4 signed-in:flex-row signed-in:flex-wrap signed-in:justify-center signed-in:gap-x-3 signed-in:gap-y-1">
              <TmdbAttribution compact />
              <RawgAttribution />
            </div>
          </footer>
          {/* Signed in: Home · Collection · ➕ · Feed · Me, floating at the bottom (ADR 0050, ADR 0053). */}
          <NavIsland />
          {/* New accounts: the getting-started checklist behind a round progress button, just above the island (ADR 0056). */}
          <GettingStartedButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
