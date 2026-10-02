import { getFormatter, getTranslations } from "next-intl/server";
import type { TitleKind } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { dtddIdFor, SCENE_CONFIRMATIONS } from "@/core/scene-warnings";
import { titleSceneWarnings, titleVerdicts } from "@/data/scene-warnings";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PaperCard } from "../paper-card";
import type { SeasonEpisodes } from "../warnings/add-scene-warning";
import { SceneWarningList } from "../warnings/scene-warning-list";

type Props = {
  supabase: UserClient;
  titleId: string;
  kind: TitleKind;
  /** The viewer's avoid-topics (DoesTheDogDie ids). */
  avoid: number[];
  /** The viewer's entry for the title, if any. */
  status: EntryStatus | null;
  /** A series' episodes by season (the picker), and the furthest one the viewer logged (where it starts). */
  seasons?: SeasonEpisodes[];
  start?: { season: number; episode: number } | null;
};

/**
 * S3 warnings & quiz: our own scene warnings for a title (every kind), with where they happen and how many people who
 * saw it confirmed them, and what the warnings quiz settled ("People who finished it say"). Read from our database
 * only, so it's shown with or without avoid-topics; a "Heads up" stamp when something confirmed is one of them.
 */
export async function SceneWarnings({ supabase, titleId, kind, avoid, status, seasons = [], start = null }: Props) {
  const [t, topics, warningsText, format] = await Promise.all([
    getTranslations("SceneWarnings"),
    getTranslations("WarningTopics"),
    getTranslations("Warnings"),
    getFormatter(),
  ]);
  const heading = <h2 className="font-display text-lg font-bold">{t("title")}</h2>;
  let loaded: Awaited<ReturnType<typeof load>>;
  try {
    loaded = await load(supabase, titleId);
  } catch (error) {
    console.error(error);
    return (
      <PaperCard className="flex flex-col gap-3 pt-6">
        {heading}
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      </PaperCard>
    );
  }
  const { warnings, verdicts } = loaded;
  const avoided = (topic: Parameters<typeof dtddIdFor>[0]) => avoid.includes(dtddIdFor(topic));
  const headsUp = warnings.some((w) => w.status === "confirmed" && avoided(w.topic)) || verdicts.some((v) => v.result === "yes" && avoided(v.topic));
  const canWarn = status === "watching" || status === "finished";

  return (
    <PaperCard id="scene-warnings" stamp={headsUp ? warningsText("headsUp") : undefined} className="flex flex-col gap-4 pt-6">
      <div className="flex flex-col gap-1">
        {heading}
        <p className="text-sm text-muted-foreground">{t("intro", { kind, count: SCENE_CONFIRMATIONS })}</p>
      </div>
      <SceneWarningList titleId={titleId} kind={kind} initial={warnings} avoid={avoid} canWarn={canWarn} seasons={seasons} start={start} />

      {verdicts.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-dashed border-border pt-4">
          <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("verdictsTitle")}</h3>
          <ul className="flex flex-col">
            {verdicts.map((v) => (
              <li key={v.topic} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
                <span className={cn("first-letter:uppercase", avoided(v.topic) && "font-semibold text-brand")}>{topics(`names.${v.topic}`)}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase",
                      v.result === "yes" ? "bg-brand text-brand-foreground" : v.result === "no" ? "bg-muted text-muted-foreground ring-1 ring-border" : "bg-card ring-1 ring-border",
                    )}
                  >
                    {t("verdict", { result: v.result })}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t("verdictCounts", { yes: format.number(v.yes), no: format.number(v.no) })}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "finished" && (
        <Link
          href={{ pathname: "/quiz", query: { title: titleId } }}
          className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          {t("quizLink")}
        </Link>
      )}
    </PaperCard>
  );
}

async function load(supabase: UserClient, titleId: string) {
  const [warnings, verdicts] = await Promise.all([titleSceneWarnings(supabase, titleId), titleVerdicts(supabase, titleId)]);
  return { warnings, verdicts };
}

/** The block while it loads. */
export async function SceneWarningsSkeleton() {
  const t = await getTranslations("SceneWarnings");
  return (
    <PaperCard className="flex flex-col gap-3 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <span aria-hidden="true" className="h-5 w-2/3 skeleton rounded-md" />
    </PaperCard>
  );
}
