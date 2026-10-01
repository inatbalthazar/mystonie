import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AvoidTopics } from "@/components/warnings/avoid-topics";
import { localizedPath } from "@/core/auth";
import type { WarningTopic } from "@/core/catalog/dtdd";
import { SCENE_TOPICS } from "@/core/scene-warnings";
import { dtddTopics } from "@/data/dtdd";
import { userClient } from "@/data/supabase-server";
import { avoidTopicIds } from "@/data/warnings";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Warnings");
  return { title: `${t("pageTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Settings → Content warnings (S2 content warnings): pick DTDD topics to avoid, grouped by category, searchable. When
 * DTDD's list can't be loaded, our own scene warning topics (S3, each a DTDD topic) stand in, so choosing still works.
 * Also the way into the warnings quiz.
 */
export default async function AvoidTopicsPage({ params }: PageProps<"/[locale]/settings/warnings">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/settings/warnings", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = auth?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [t, quiz, ours, avoid, topics] = await Promise.all([
    getTranslations("Warnings"),
    getTranslations("Quiz"),
    getTranslations("WarningTopics"),
    avoidTopicIds(supabase, userId),
    dtddTopics().catch((e: unknown): WarningTopic[] | null => {
      console.warn("DTDD topics failed", e instanceof Error ? e.message : e);
      return null;
    }),
  ]);
  const list: WarningTopic[] =
    topics && topics.length > 0
      ? topics
      : SCENE_TOPICS.map((topic) => ({ id: topic.dtddId, name: ours(`names.${topic.slug}`), category: ours(`categories.${topic.category}`), spoiler: false }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageIntro")}</p>
      </div>
      <AvoidTopics topics={list} initial={avoid} />
      <p className="flex flex-col gap-1 rounded-2xl bg-muted p-4 text-sm">
        <span className="text-muted-foreground">{quiz("settingsBody")}</span>
        <Link href="/quiz" className="flex min-h-11 items-center self-start font-semibold text-brand">
          {quiz("settingsLink")}
        </Link>
      </p>
    </main>
  );
}
