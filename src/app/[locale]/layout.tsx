import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Card fallbacks for non-Latin text. Not preloaded: their @font-face rules use unicode-range,
// so the browser only downloads a script's files when a card actually contains it.
const notoThai = Noto_Sans_Thai({ variable: "--font-noto-thai", subsets: ["thai"], preload: false });
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", weight: ["400", "700"], preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", weight: ["400", "700"], preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { metadataBase: siteUrl(), title: t("title"), description: t("description") };
}

// Browser chrome matches the page background of each theme (--background in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} ${notoKr.variable} ${notoJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {children}
          <footer className="flex flex-col items-center gap-3 p-4">
            <LocaleSwitcher />
            <TmdbAttribution />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
