"use client";

import { CheckIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TitleKind } from "@/core/catalog/types";
import { dtddIdFor, SCENE_CONFIRMATIONS, sortSceneWarnings, type SceneWarning } from "@/core/scene-warnings";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Sheet } from "../sheet";
import { AddSceneWarning, type SeasonEpisodes } from "./add-scene-warning";
import { usePlaceLabel, useTopicName } from "./scene-place";

type Tally = Pick<SceneWarning, "status" | "confirms" | "disputes" | "myVote">;

/**
 * A title's scene warnings (S3 warnings & quiz): each one's topic, where it happens and how many people confirmed it.
 * People who watched or read the title vote ("Saw it" / "Not there", tap again to take it back) and add their own;
 * their own can be withdrawn while they wait. Topics the viewer avoids are marked.
 */
export function SceneWarningList({
  titleId,
  kind,
  initial,
  avoid,
  canWarn,
  seasons,
  start,
}: {
  titleId: string;
  kind: TitleKind;
  initial: SceneWarning[];
  /** The viewer's avoid-topics (DoesTheDogDie ids). */
  avoid: number[];
  /** Watching or finished: may add warnings and vote. */
  canWarn: boolean;
  seasons: SeasonEpisodes[];
  start: { season: number; episode: number } | null;
}) {
  const t = useTranslations("SceneWarnings");
  const topicName = useTopicName();
  const placeLabel = usePlaceLabel();
  const [list, setList] = useState(() => sortSceneWarnings(initial));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);

  function apply(id: string, tally: Tally | null) {
    // A warning that others just disputed leaves the list (its adder still sees it).
    setList((current) => current.flatMap((w) => (w.id !== id ? [w] : !tally || (tally.status === "disputed" && !w.mine) ? [] : [{ ...w, ...tally }])));
  }

  async function vote(w: SceneWarning, choice: 1 | -1) {
    const next = w.myVote === choice ? 0 : choice;
    setBusy(w.id);
    setNote(null);
    try {
      const res = await fetch(`/api/scene-warnings/${w.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vote: next }) });
      if (res.status === 404) apply(w.id, null);
      else if (!res.ok) throw new Error(String(res.status));
      else apply(w.id, (await res.json()) as Tally);
      track("scene_warning_voted", { vote: next === 1 ? "confirm" : next === -1 ? "dispute" : "undo" });
    } catch {
      setNote({ error: true, text: t("voteError") });
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(w: SceneWarning) {
    setBusy(w.id);
    setNote(null);
    try {
      const res = await fetch(`/api/scene-warnings/${w.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      apply(w.id, null);
    } catch {
      setNote({ error: true, text: t("voteError") });
    } finally {
      setBusy(null);
    }
  }

  function added(w: SceneWarning) {
    setAdding(false);
    setList((current) => sortSceneWarnings([...current, w]));
    setNote({ error: false, text: t("added", { count: SCENE_CONFIRMATIONS - w.confirms }) });
  }

  function confirmInstead(w: SceneWarning) {
    setAdding(false);
    if (w.myVote !== 1) void vote(w, 1);
  }

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-border">
          {list.map((w) => {
            const name = topicName(w.topic);
            const place = placeLabel(w);
            const avoided = avoid.includes(dtddIdFor(w.topic));
            return (
              <li key={w.id} className={cn("flex flex-col gap-2 py-3", avoided && "-mx-2 rounded-xl bg-brand-soft/60 px-2")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-semibold first-letter:uppercase">{name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{place}</span>
                </div>
                {avoided && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                    <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
                    {t("yourTopic")}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                      w.status === "confirmed" ? "rotate-[-2deg] border-2 border-brand/80 text-brand" : "border border-dashed border-border text-muted-foreground",
                    )}
                  >
                    {w.status === "confirmed"
                      ? t("confirmed", { count: w.confirms })
                      : w.status === "disputed"
                        ? t("disputed")
                        : t("pending", { count: w.confirms, total: SCENE_CONFIRMATIONS })}
                  </span>
                  {w.mine ? (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t("addedByYou")}
                      {w.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => withdraw(w)}
                          disabled={busy === w.id}
                          className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {t("withdraw")}
                        </button>
                      )}
                    </span>
                  ) : (
                    canWarn && (
                      <span className="flex gap-2">
                        {([1, -1] as const).map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            aria-pressed={w.myVote === choice}
                            aria-label={t(choice === 1 ? "sawItLabel" : "notThereLabel", { topic: name, place })}
                            onClick={() => vote(w, choice)}
                            disabled={busy === w.id}
                            className={cn(
                              "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors disabled:opacity-50",
                              w.myVote === choice ? "bg-foreground text-background ring-foreground" : "ring-border hover:bg-muted",
                            )}
                          >
                            {choice === 1 ? <CheckIcon aria-hidden="true" className="size-4" /> : <XIcon aria-hidden="true" className="size-4" />}
                            {t(choice === 1 ? "sawIt" : "notThere")}
                          </button>
                        ))}
                      </span>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Always there (a live region announces what's put in it), out of the layout while empty. */}
      <p aria-live="polite" className={cn("text-sm", !note && "sr-only", note?.error ? "font-medium text-destructive" : "text-muted-foreground")}>
        {note?.text}
      </p>

      {canWarn ? (
        <div className="flex flex-col gap-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{t("addHint")}</p>}
          <button
            type="button"
            onClick={() => {
              setNote(null);
              setAdding(true);
            }}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full px-4 font-semibold ring-1 ring-border hover:bg-muted press"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {t("add")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("needsSeen", { kind })}</p>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t("addTitle")} closeLabel={t("close")}>
        <AddSceneWarning titleId={titleId} kind={kind} seasons={seasons} start={start} existing={list} onAdded={added} onConfirm={confirmInstead} />
      </Sheet>
    </div>
  );
}
