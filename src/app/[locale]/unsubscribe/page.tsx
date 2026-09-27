import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnsubscribeForm } from "@/components/unsubscribe-form";
import { isEmailList } from "@/core/email/unsubscribe";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Unsubscribe");
  // Personal links: keep them out of search results.
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** Target of the unsubscribe link in our emails (`?id=<waitlist id or profile id>&t=<token>[&list=recaps]`). */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/unsubscribe">) {
  setRequestLocale((await params).locale as Locale);
  const [t, query] = await Promise.all([getTranslations("Unsubscribe"), searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const list = one(query.list) || "waitlist";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-12 pb-8">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <UnsubscribeForm id={one(query.id)} token={one(query.t)} list={isEmailList(list) ? list : null} />
    </main>
  );
}
