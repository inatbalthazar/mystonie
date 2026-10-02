import { CompassIcon, GemIcon, MessageSquareHeartIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { FeedbackForm } from "@/components/beta/feedback-form";
import { PaperCard } from "@/components/paper-card";
import { feedbackPage, isFeedbackKind } from "@/core/feedback";
import { myFeedback, type MyFeedback } from "@/data/feedback";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Beta");
  return { title: `${t("title")} · Mystonie`, robots: { index: false } };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /feedback (ADR 0055): what "beta" means, "Report a problem" (signed out too), and a signed-in reporter's own
 * reports with what became of them. `?from=` is the page the link was on, `?kind=` picks the kind, `?ref=` is an
 * error page's digest.
 */
export default async function FeedbackPage({ params, searchParams }: PageProps<"/[locale]/feedback">) {
  setRequestLocale((await params).locale as Locale);
  const query = await searchParams;
  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  const signedIn = !!auth?.claims.sub;
  const [t, format, reports] = await Promise.all([
    getTranslations("Beta"),
    getFormatter(),
    supabase && signedIn
      ? myFeedback(supabase).catch((error): MyFeedback[] => {
          console.error("feedback read", error);
          return [];
        })
      : ([] as MyFeedback[]),
  ]);
  const kind = one(query.kind);
  const ref = one(query.ref);
  const mail = (chunks: ReactNode) => (
    <a href={`mailto:${LEGAL.helloEmail}`} className="underline underline-offset-4">
      {chunks}
    </a>
  );

  const points = [
    { icon: ShieldCheckIcon, text: t("pointSafe") },
    { icon: CompassIcon, text: t("pointChanges") },
    { icon: MessageSquareHeartIcon, text: t("pointListen") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-12 pb-12">
      <header className="flex flex-col gap-3">
        <p className="self-start -rotate-3 rounded-md border-2 border-brand px-2 py-0.5 font-display text-sm font-extrabold tracking-[0.18em] text-brand">
          {t("badge")}
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-balance">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("whatItMeans")}</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
          <li className="flex gap-3">
            <GemIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              {t.rich("pointPro", {
                pro: (chunks) => (
                  <Link href="/pro" className="font-medium underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </li>
        </ul>
      </PaperCard>

      <section aria-labelledby="report" className="flex flex-col gap-3">
        <h2 id="report" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          {t("reportTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{signedIn ? t.rich("replySignedIn", { mail }) : t.rich("replySignedOut", { mail, email: LEGAL.helloEmail })}</p>
        <FeedbackForm initialKind={isFeedbackKind(kind) ? kind : "bug"} page={feedbackPage(one(query.from))} errorRef={ref ?? null} signedIn={signedIn} />
      </section>

      {reports.length > 0 && (
        <section aria-labelledby="yours" className="flex flex-col gap-3">
          <h2 id="yours" className="font-display text-lg font-bold">
            {t("yours")}
          </h2>
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t("kind", { kind: r.kind })} · {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })}
                  </span>
                  <span
                    className={cn(
                      "rounded-md border-2 px-1.5 font-display text-xs font-extrabold tracking-[0.12em] uppercase",
                      r.status === "fixed" ? "border-brand text-brand" : "border-border text-muted-foreground",
                    )}
                  >
                    {t("status", { status: r.status })}
                  </span>
                </div>
                <p className="line-clamp-3 text-sm whitespace-pre-line">{r.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
