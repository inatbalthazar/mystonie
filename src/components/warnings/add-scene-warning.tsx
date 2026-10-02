"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import type { TitleKind } from "@/core/catalog/types";
import { uuidv7 } from "@/core/ids";
import {
  parseTimecode,
  SCENE_TOPIC_CATEGORIES,
  sceneUnitsFor,
  similarWarnings,
  topicCategory,
  topicsFor,
  type SceneTopicSlug,
  type SceneUnit,
  type SceneWarning,
} from "@/core/scene-warnings";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { upperFirst, usePlaceLabel, useTopicName } from "./scene-place";

/** A series' episodes by season, for the episode picker. */
export type SeasonEpisodes = { season: number; episodes: number[] };

type Status = "idle" | "saving" | "not_seen" | "duplicate" | "limit" | "error" | "time";

const field =
  "h-12 w-full rounded-2xl border border-input bg-card px-4 text-base shadow-sm outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50";
const labelText = "text-sm font-semibold";

/**
 * The "Add a scene warning" sheet's form (S3 warnings & quiz): what happens, and optionally where: a series' season and
 * episode, a time into the movie or episode, a book's chapter or page, a manga's chapter or volume. Before adding,
 * the same topic noted by someone else at the same episode is offered to confirm instead, so votes gather on one.
 */
export function AddSceneWarning({
  titleId,
  kind,
  seasons,
  start,
  existing,
  onAdded,
  onConfirm,
}: {
  titleId: string;
  kind: TitleKind;
  seasons: SeasonEpisodes[];
  /** The episode the picker starts on (the furthest one logged). */
  start: { season: number; episode: number } | null;
  existing: SceneWarning[];
  onAdded: (warning: SceneWarning) => void;
  onConfirm: (warning: SceneWarning) => void;
}) {
  const t = useTranslations("SceneWarnings");
  const categories = useTranslations("WarningTopics");
  const topicName = useTopicName();
  const placeLabel = usePlaceLabel();
  const id = useId();
  const screen = kind === "movie" || kind === "series";
  const units = sceneUnitsFor(kind);
  const available = topicsFor(kind);

  const [topic, setTopic] = useState<SceneTopicSlug | "">("");
  const first = start && seasons.some((s) => s.season === start.season) ? start : null;
  const [season, setSeason] = useState<number | null>(first?.season ?? null);
  const [episode, setEpisode] = useState<number | null>(first?.episode ?? null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unit, setUnit] = useState<SceneUnit | null>(units[0] ?? null);
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const episodes = seasons.find((s) => s.season === season)?.episodes ?? [];
  // A series' time needs an episode to be a time into.
  const timed = kind === "movie" || (kind === "series" && season !== null);
  const at = kind === "series" ? { season, episode: season === null ? null : episode } : { season: null, episode: null };
  const similar = topic ? similarWarnings(existing, topic, at) : [];

  function pickSeason(value: string) {
    const next = value === "" ? null : Number(value);
    setSeason(next);
    setEpisode(next === null ? null : (seasons.find((s) => s.season === next)?.episodes[0] ?? null));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!topic) return;
    const startSec = timed && from.trim() ? parseTimecode(from) : null;
    const endSec = timed && to.trim() ? parseTimecode(to) : null;
    if ((timed && from.trim() && startSec === null) || (timed && to.trim() && endSec === null) || (endSec !== null && (startSec === null || endSec < startSec))) {
      setStatus("time");
      return;
    }
    const number = position.trim() ? Number(position) : null;
    const placed = unit !== null && number !== null && Number.isInteger(number) && number > 0;
    const body = {
      id: uuidv7(),
      titleId,
      topic,
      season: at.episode === null ? null : at.season,
      episode: at.episode,
      startSec,
      endSec,
      unit: placed ? unit : null,
      position: placed ? number : null,
    };
    setStatus("saving");
    try {
      const res = await fetch("/api/scene-warnings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 201) {
        const { warning } = (await res.json()) as { warning: SceneWarning };
        track("scene_warning_added", { topic, placed: body.episode !== null || startSec !== null || placed });
        onAdded(warning);
        return;
      }
      setStatus(res.status === 403 ? "not_seen" : res.status === 409 ? "duplicate" : res.status === 429 ? "limit" : "error");
    } catch {
      setStatus("error");
    }
  }

  const fromOk = parseTimecode(from) !== null;
  const toOk = parseTimecode(to) !== null;
  const error =
    status === "time"
      ? (from.trim() && !fromOk) || (to.trim() && !toOk)
        ? t("timeInvalid")
        : !from.trim()
          ? t("startMissing")
          : t("endBeforeStart")
      : status === "not_seen"
        ? t("errorNotSeen", { kind })
        : status === "duplicate"
          ? t("errorDuplicate")
          : status === "limit"
            ? t("errorLimit")
            : status === "error"
              ? t("errorGeneric")
              : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className={labelText}>{t("topicLabel")}</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value as SceneTopicSlug | "")} required className={field}>
          <option value="">{t("topicPlaceholder")}</option>
          {SCENE_TOPIC_CATEGORIES.map((category) => {
            const inCategory = available.filter((slug) => topicCategory(slug) === category);
            if (inCategory.length === 0) return null;
            return (
              <optgroup key={category} label={categories(`categories.${category}`)}>
                {inCategory.map((slug) => (
                  <option key={slug} value={slug}>
                    {upperFirst(topicName(slug))}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className={cn(labelText, "mb-1.5")}>{t("whereLabel")}</legend>
        {kind === "series" && seasons.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("seasonLabel")}</span>
              <select value={season ?? ""} onChange={(e) => pickSeason(e.target.value)} className={field}>
                <option value="">{t("throughout")}</option>
                {seasons.map((s) => (
                  <option key={s.season} value={s.season}>
                    {t("seasonOption", { season: s.season })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("episodeLabel")}</span>
              <select value={episode ?? ""} onChange={(e) => setEpisode(Number(e.target.value))} disabled={season === null} className={field}>
                {season === null && <option value="">–</option>}
                {episodes.map((n) => (
                  <option key={n} value={n}>
                    {t("episodeOption", { episode: n })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {screen && timed && (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("fromLabel")}</span>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="41:10"
                  autoComplete="off"
                  aria-describedby={`${id}-time`}
                  className={cn(field, "tabular-nums")}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("toLabel")}</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="42:30"
                  autoComplete="off"
                  aria-describedby={`${id}-time`}
                  className={cn(field, "tabular-nums")}
                />
              </label>
            </div>
            <p id={`${id}-time`} className="text-xs text-muted-foreground">
              {t("timeHint", { kind })}
            </p>
          </div>
        )}
        {units.length > 0 && unit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("unitLabel")}</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value as SceneUnit)} className={field}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {t("unit", { unit: u })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("positionLabel", { unit })}</span>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                autoComplete="off"
                className={cn(field, "tabular-nums")}
              />
            </label>
          </div>
        )}
      </fieldset>

      {similar.length > 0 && (
        <div role="note" className="flex flex-col gap-2 rounded-2xl bg-muted p-4">
          <p className="text-sm font-medium">{t("similar")}</p>
          <ul className="flex flex-col gap-2">
            {similar.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums">{placeLabel(w)}</span>
                <button
                  type="button"
                  onClick={() => onConfirm(w)}
                  className="inline-flex min-h-11 items-center rounded-xl bg-card px-4 text-sm font-semibold ring-1 ring-border hover:bg-background"
                >
                  {t("confirmInstead")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!topic || status === "saving"}
        className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
      >
        {status === "saving" ? t("saving") : t("save")}
      </button>
    </form>
  );
}
