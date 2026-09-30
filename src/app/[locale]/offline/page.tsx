import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SavedPages } from "@/components/offline/saved-pages-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Offline");
  return { title: `${t("metaTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * What the installed app shows offline for a page this device hasn't saved (S3 offline, ADR 0042): the service worker
 * keeps this page and serves it in their place. Static, so it can be saved for anyone.
 */
export default async function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("Offline");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-12 pb-16">
      <section className="relative flex rotate-[-0.6deg] flex-col items-center gap-4 rounded-3xl bg-card px-6 pt-12 pb-8 text-center shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_30px_-18px_rgb(0_0_0/0.35)] ring-1 ring-border">
        <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10" />
        <p
          aria-hidden="true"
          className="rotate-[-8deg] rounded-xl border-4 border-dashed border-muted-foreground px-4 py-1 font-display text-2xl font-extrabold tracking-[0.12em] text-muted-foreground uppercase [&:lang(th)]:tracking-normal"
        >
          {t("pageStamp")}
        </p>
        <h1 className="font-hand text-3xl leading-tight text-balance">{t("pageTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("pageBody")}</p>
        <SavedPages />
      </section>
    </main>
  );
}
