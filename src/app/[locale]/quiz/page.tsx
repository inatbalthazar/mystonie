import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WarningsQuiz } from "@/components/warnings/warnings-quiz";
import { localizedPath } from "@/core/auth";
import { parseQuizTitle } from "@/core/quiz";
import { NO_STANDING, quizStanding } from "@/core/quiz-standing";
import { quizHelps } from "@/data/badges";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Quiz");
  return { title: `${t("metaTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * The warnings quiz (S3 warnings & quiz): quick questions about titles the user finished, one at a time. `?title=`
 * (a title id, from its page) asks about that title first. Above it, where the user stands: answers, final says, the
 * day streak and the next sticker (ADR 0094). Signed-in only.
 */
export default async function QuizPage({ params, searchParams }: PageProps<"/[locale]/quiz">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/quiz", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  if (!supabase || !auth?.claims.sub) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const userId = auth.claims.sub;
  const [t, query, helps, { data: profile }] = await Promise.all([
    getTranslations("Quiz"),
    searchParams,
    quizHelps(supabase, userId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    supabase.from("profiles").select("time_zone").eq("id", userId).maybeSingle(),
  ]);
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const standing = helps ? quizStanding(helps, profile?.time_zone ?? "UTC", Date.now()) : NO_STANDING;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <WarningsQuiz titleId={parseQuizTitle(query.title)} standing={standing} />
    </main>
  );
}
