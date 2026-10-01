import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaperCard } from "@/components/paper-card";
import { ProActions } from "@/components/pro/pro-actions";
import { PLANNED_PRICES, type PlanPrice } from "@/core/billing";
import { planPrices, stripeConfig } from "@/data/stripe";
import { getProState } from "@/data/subscriptions";
import { userClient } from "@/data/supabase-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pro");
  return { title: `${t("title")} · Mystonie` };
}

/**
 * Mystonie Pro (S2 Pro, ADR 0034): what it adds, the plans, and buying or managing it. While Pro isn't on sale (the
 * beta, ADR 0055) it still shows the offer and the planned prices, with the buttons greyed out.
 */
export default async function ProPage({ params, searchParams }: PageProps<"/[locale]/pro">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const config = stripeConfig();

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = auth?.claims.sub ?? null;
  const [state, t] = await Promise.all([getProState(supabase, userId), getTranslations("Pro")]);
  // The plans only matter to someone who isn't Pro yet.
  const prices = !config
    ? [...PLANNED_PRICES]
    : state.pro
      ? []
      : await planPrices(config).catch((error): PlanPrice[] => {
          console.error("stripe prices", error);
          return [];
        });
  const checkout = (await searchParams).checkout === "success";
  const features = ["featureTemplates", "featureFirst", "featureSupport"] as const;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-12 pb-12">
      <header className="flex flex-col gap-3">
        <p className="self-start -rotate-3 rounded-md border-2 border-brand px-2 py-0.5 font-display text-sm font-extrabold tracking-[0.18em] text-brand">
          {t("stamp")}
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("whatYouGet")}</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {features.map((f) => (
            <li key={f} className="flex gap-3">
              <CheckIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-hand text-xl text-muted-foreground">{t("freeStaysFree")}</p>
      </PaperCard>

      <ProActions state={state} prices={prices} signedIn={!!userId} checkout={checkout} />
    </main>
  );
}
