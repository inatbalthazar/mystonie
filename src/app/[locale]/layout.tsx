import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Geist, Noto_Sans_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountLink } from "@/components/account-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { PwaListener } from "@/components/pwa/browser";
import { ThemeScript } from "@/components/theme-script";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
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

// Browser chrome matches the page background of each theme (--background in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#161310" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal" });

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${bricolage.variable} ${caveat.variable} ${notoThai.variable} h-full antialiased`}
      suppressHydrationWarning // THEME_SCRIPT may set data-theme before React hydrates
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        <PwaListener />
        <NextIntlClientProvider>
          <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-4">
            <Logo />
            <AccountLink />
          </header>
          {children}
          <footer className="mt-auto flex flex-col items-center gap-4 border-t border-border px-4 pt-8 pb-10">
            <LocaleSwitcher />
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/privacy" className="underline-offset-4 hover:underline">
                {t("privacy")}
              </Link>
              <Link href="/terms" className="underline-offset-4 hover:underline">
                {t("terms")}
              </Link>
            </nav>
            <TmdbAttribution />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
