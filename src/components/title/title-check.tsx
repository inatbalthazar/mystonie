import { CircleCheckIcon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { StonieHop } from "@/components/motion/stonie-hop";
import type { TitleWarnings } from "@/core/catalog/dtdd";
import type { TitleKind } from "@/core/catalog/types";
import { sceneTopicForDtdd } from "@/core/scene-warnings";
import { titleCheck, type CheckTopic } from "@/core/warnings";
import { dtddTopics } from "@/data/dtdd";
import { communityAvoidHits } from "@/data/scene-warnings";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PaperCard } from "../paper-card";
import { FamilyCheckButton } from "./family-check-button";

type Props = {
  supabase: UserClient;
  titleId: string;
  kind: TitleKind;
  /** The viewer's avoid-topics (DoesTheDogDie ids). */
  avoid: number[];
  /** DTDD's answer for a movie or series (the same lookup as the warnings block below); null for other kinds. */
  dtdd: Promise<TitleWarnings | null> | null;
};

const linkClass = "text-sm font-semibold text-brand underline-offset-2 hover:underline";

/**
 * Stage 4, "Check a title before you watch": the verdict at the top of every title page, against the viewer's
 * avoid-topics, from DoesTheDogDie's votes (movies and series) and our own confirmed warnings and quiz answers (every
 * kind). Without avoid-topics it offers the one-tap family check. Rendered inside Suspense: DTDD never holds the page.
 */
export async function TitleCheck({ supabase, titleId, kind, avoid, dtdd }: Props) {
  const [t, names, format] = await Promise.all([getTranslations("TitleCheck"), getTranslations("WarningTopics"), getFormatter()]);
  const heading = <h2 className="font-display text-lg font-bold">{t("title", { kind })}</h2>;

  if (avoid.length === 0) {
    return (
      <PaperCard id="title-check" className="flex flex-col gap-3 pt-6">
        {heading}
        <p className="text-sm text-muted-foreground">{t("setup", { kind })}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FamilyCheckButton />
          <Link href="/settings/warnings" className={linkClass}>
            {t("ownTopics")}
          </Link>
        </div>
      </PaperCard>
    );
  }

  const [warnings, ours] = await Promise.all([dtdd, communityAvoidHits(supabase, [titleId])]);
  const check = titleCheck(avoid, warnings?.status === "matched" ? warnings.topics : null, ours.get(titleId) ?? []);

  // Our own topics in the viewer's language, other DTDD topics by DTDD's name (its topic list when it had no votes).
  const unnamed = check.verdict === "hits" && check.hits.some((h) => !h.name && !sceneTopicForDtdd(h.id));
  const dtddNames = unnamed ? new Map((await dtddTopics().catch(() => [])).map((topic) => [topic.id, topic.name])) : new Map<number, string>();
  const nameOf = (h: CheckTopic) => {
    const slug = sceneTopicForDtdd(h.id);
    return slug ? names(`names.${slug}`) : (h.name ?? dtddNames.get(h.id) ?? null);
  };
  const edit = (
    <Link href="/settings/warnings" className={linkClass}>
      {t("editTopics")}
    </Link>
  );

  if (check.verdict === "hits") {
    const hits = check.hits.flatMap((h) => {
      const name = nameOf(h);
      return name ? [{ ...h, name }] : [];
    });
    return (
      <PaperCard id="title-check" stamp={t("stamp")} className="flex flex-col gap-3 pt-6">
        {heading}
        <p role="note" className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 font-semibold ring-1 ring-brand/20">
          <TriangleAlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" />
          {t("hits", { count: hits.length, topics: format.list(hits.map((h) => h.name), { type: "conjunction" }) })}
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {hits.map((h) => (
            <li key={h.id} className="flex flex-wrap justify-between gap-x-3">
              <span className="font-medium first-letter:uppercase">{h.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {[
                  h.yes !== undefined && t("dtddVotes", { yes: format.number(h.yes), no: format.number(h.no ?? 0) }),
                  h.ours && t("oursSource"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href={kind === "movie" || kind === "series" ? "#content-warnings" : "#scene-warnings"} className={linkClass}>
            {t("details")}
          </a>
          {edit}
        </div>
      </PaperCard>
    );
  }

  const clear = check.verdict === "clear";
  const Icon = clear ? CircleCheckIcon : CircleHelpIcon;
  return (
    <PaperCard id="title-check" className="flex flex-col gap-3 pt-6">
      {heading}
      <p className="flex items-start gap-2 font-semibold">
        <Icon aria-hidden="true" className={cn("mt-1 size-4 shrink-0", clear ? "text-brand" : "text-muted-foreground")} />
        {clear ? t("clear") : t("unknown")}
      </p>
      <p className="text-sm text-muted-foreground">
        {clear
          ? check.unsure === 0
            ? t("sureAll", { count: check.sure })
            : t("sureSome", { sure: check.sure, total: check.sure + check.unsure })
          : kind === "movie" || kind === "series"
            ? t(warnings ? "unknownBody" : "unavailable")
            : t("unknownOurs", { kind })}
      </p>
      {edit}
    </PaperCard>
  );
}

/** The block while DTDD answers. */
export async function TitleCheckSkeleton({ kind }: { kind: TitleKind }) {
  const t = await getTranslations("TitleCheck");
  return (
    <PaperCard className="flex flex-col gap-3 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title", { kind })}</h2>
      <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <StonieHop size={24} />
        {t("checking")}
      </p>
    </PaperCard>
  );
}
