import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { SUPPORT_URL } from "@/lib/site";

// Section order per page. Text lives in messages/en.json (English only: other locales fall back to it).
export const LEGAL_SECTIONS = {
  Privacy: ["who", "cards", "account", "collect", "use", "processors", "transfers", "retention", "rights", "children", "changes"],
  Terms: ["service", "content", "tmdb", "use", "brand", "tips", "liability", "changes", "contact"],
} as const;

type Doc = keyof typeof LEGAL_SECTIONS;

function external(href: string) {
  return function ExternalLink(chunks: ReactNode) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {chunks}
      </a>
    );
  };
}

export async function legalMetadata(doc: Doc): Promise<Metadata> {
  const t = await getTranslations(doc);
  return { title: `${t("title")} · Mystonie` };
}

export async function LegalPage({ doc }: { doc: Doc }) {
  const [t, tl, format] = await Promise.all([getTranslations(doc), getTranslations("Legal"), getFormatter()]);
  const [y, m, d] = LEGAL.updatedOn.split("-").map(Number);
  const updated = format.dateTime(new Date(Date.UTC(y!, m! - 1, d!)), { dateStyle: "long", timeZone: "UTC" });
  const tags = {
    email: LEGAL.contactEmail,
    mail: (chunks: ReactNode) => (
      <a href={`mailto:${LEGAL.contactEmail}`} className="underline underline-offset-2">
        {chunks}
      </a>
    ),
    operator: external(LEGAL.operatorSite),
    tmdb: external("https://www.themoviedb.org/"),
    rawg: external("https://rawg.io/"),
    bmc: external(SUPPORT_URL),
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-12 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{tl("lastUpdated", { date: updated })}</p>
        <p>{t("intro")}</p>
      </header>
      {LEGAL_SECTIONS[doc].map((key) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(`sections.${key}.title`)}</h2>
          <p className="leading-relaxed text-muted-foreground">{t.rich(`sections.${key}.body`, tags)}</p>
        </section>
      ))}
      <Link href="/" className="underline underline-offset-4">
        {tl("backHome")}
      </Link>
    </main>
  );
}
