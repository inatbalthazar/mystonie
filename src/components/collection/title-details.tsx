"use client";

import { ChevronDownIcon, CircleCheckIcon, CircleHelpIcon, ExternalLinkIcon, StarIcon, TriangleAlertIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { DTDD_URL } from "@/core/catalog/dtdd";
import { isScreenKind, type SearchResult } from "@/core/catalog/types";
import { imdbUrl, type TitlePreview } from "@/core/title-preview";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { TmdbAttribution } from "../tmdb-attribution";
import { useTopicName, useWarningLabel } from "../warnings/warning-badge";

type State = { status: "closed" | "loading" | "error" } | { status: "open"; preview: TitlePreview };

const linkClass = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-2 hover:underline";

/**
 * "Look before you add" (stage 4, ADR 0058): on the ➕ sheet's status step, the warning note for the viewer's
 * avoid-topics (from the search badge, then from the details once loaded) and, one tap away, the title's details:
 * synopsis, TMDB score, IMDb link, who made it and DoesTheDogDie's most-voted topics. Loaded only when asked for: a
 * DTDD lookup spends its small quota. The status buttons below stay where they are, so adding is still 3 taps.
 */
export function TitleDetails({ result, warning }: { result: SearchResult; warning: string | null }) {
  const t = useTranslations("TitleDetails");
  const panelId = useId();
  const warningLabel = useWarningLabel();
  const [state, setState] = useState<State>({ status: "closed" });
  const [shown, setShown] = useState(false);

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/titles/preview/${result.kind}/${encodeURIComponent(result.externalId)}`);
      if (!res.ok) throw new Error(String(res.status));
      setState({ status: "open", preview: (await res.json()) as TitlePreview });
    } catch {
      setState({ status: "error" });
    }
  }

  function toggle() {
    const next = !shown;
    setShown(next);
    if (next && state.status !== "open" && state.status !== "loading") {
      track("title_details_opened", { kind: result.kind });
      void load();
    }
  }

  const preview = state.status === "open" ? state.preview : null;
  // Fresh details win over the search badge (which reads the cache only).
  const note = preview ? (preview.check?.verdict === "hits" ? warningLabel(preview.check.hits) : null) : warning;

  return (
    <div className="flex flex-col gap-3">
      {note && (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-semibold ring-1 ring-brand/20">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          {note}
        </p>
      )}
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-4 text-left text-sm font-semibold ring-1 ring-border hover:bg-muted"
      >
        {t("toggle")}
        <ChevronDownIcon aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", shown && "rotate-180")} />
      </button>
      <div id={panelId} hidden={!shown} aria-busy={state.status === "loading"}>
        {state.status === "loading" && (
          <div aria-hidden="true" className="flex flex-col gap-2 px-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-4 animate-pulse rounded-md bg-muted" style={{ width: `${90 - i * 20}%` }} />
            ))}
          </div>
        )}
        {state.status === "loading" && <p className="sr-only">{t("loading")}</p>}
        {state.status === "error" && (
          <p className="flex flex-wrap items-center gap-x-3 px-1 text-sm text-muted-foreground">
            {t("error")}
            <button type="button" onClick={load} className={linkClass}>
              {t("retry")}
            </button>
          </p>
        )}
        {preview && <Details preview={preview} result={result} />}
      </div>
    </div>
  );
}

function Details({ preview, result }: { preview: TitlePreview; result: SearchResult }) {
  const t = useTranslations("TitleDetails");
  const format = useFormatter();
  const [more, setMore] = useState(false);
  const { title, facts } = preview;
  const kind = title.kind;
  const list = (names: string[]) => format.list(names, { type: "conjunction" });
  const lines = [
    title.genres.length > 0 && format.list(title.genres, { type: "unit" }),
    kind === "series" && title.seasonCount
      ? t("seasons", {
          seasons: title.seasonCount,
          episodes: title.episodeCount ?? 0,
        })
      : null,
    title.runtimeMin && (kind === "movie" || kind === "series") ? t("runtime", { kind, minutes: title.runtimeMin }) : null,
    preview.directors.length > 0 && t("directors", { kind, names: list(preview.directors) }),
    preview.cast.length > 0 && t("cast", { names: list(preview.cast) }),
    preview.makers.length > 0 && t("makers", { kind, names: list(preview.makers) }),
  ].filter((line): line is string => !!line);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
      {facts.score !== null && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <StarIcon aria-hidden="true" className="size-4 fill-current text-brand" />
          <span className="font-semibold">
            {t("score", {
              score: format.number(facts.score, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            })}
          </span>
          {facts.votes !== null && <span className="text-muted-foreground">{t("votes", { count: facts.votes })}</span>}
        </p>
      )}
      {(facts.tagline || facts.overview) && (
        <div className="flex flex-col gap-1.5 text-sm">
          {facts.tagline && <p className="font-hand text-xl leading-tight">{facts.tagline}</p>}
          {facts.overview && (
            <>
              <p className={cn("leading-relaxed", !more && "line-clamp-5")}>{facts.overview}</p>
              {facts.overview.length > 240 && (
                <button type="button" onClick={() => setMore((m) => !m)} className="self-start text-sm font-semibold text-brand">
                  {more ? t("less") : t("more")}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-5">
        {facts.imdbId && (
          <a href={imdbUrl(facts.imdbId)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("imdb")}
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
        )}
        <Link href={`/title/${result.kind}/${result.externalId}`} className={linkClass}>
          {t("page", { kind })}
        </Link>
      </div>
      <Warnings preview={preview} />
      {title.source === "tmdb" && <TmdbAttribution />}
    </div>
  );
}

function Warnings({ preview }: { preview: TitlePreview }) {
  const t = useTranslations("TitleDetails");
  const w = useTranslations("Warnings");
  const check = useTranslations("TitleCheck");
  const format = useFormatter();
  const nameOf = useTopicName();
  const headingId = useId();
  const { warnings, check: mine } = preview;
  const screen = isScreenKind(preview.title.kind);
  const Icon = mine?.verdict === "clear" ? CircleCheckIcon : CircleHelpIcon;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5 border-t border-dashed border-border pt-4">
      <h3 id={headingId} className="font-display text-base font-bold">
        {w("title")}
      </h3>
      {/* The viewer's own topics (hits with their votes, clear or unknown), or an invitation to choose some. */}
      {mine === null ? (
        <p className="text-sm text-muted-foreground">
          {w("setupBody")}{" "}
          <Link href="/settings/warnings" className="font-semibold text-brand underline-offset-2 hover:underline">
            {w("setupLink")}
          </Link>
        </p>
      ) : mine.verdict === "hits" ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{w("yourTopics")}</p>
          <ul aria-label={w("yourTopics")} className="flex flex-col gap-1 text-sm">
            {mine.hits.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-x-3">
                <span className="font-medium first-letter:uppercase">{nameOf(h) ?? w("title")}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {h.yes !== undefined
                    ? check("dtddVotes", {
                        yes: format.number(h.yes),
                        no: format.number(h.no ?? 0),
                      })
                    : check("oursSource")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-sm font-semibold">
          <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", mine.verdict === "clear" ? "text-brand" : "text-muted-foreground")} />
          {mine.verdict === "clear" ? check("clear") : check("unknown")}
        </p>
      )}

      {screen && warnings?.status === "matched" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("flagged")}</p>
          {warnings.flagged.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {warnings.flagged.map((topic) => (
                <li key={topic.id} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm ring-1 ring-border">
                  <span className="first-letter:uppercase">{nameOf(topic)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t("yesVotes", { count: topic.yes })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noFlags")}</p>
          )}
          {warnings.more > 0 && <p className="text-sm text-muted-foreground">{t("flaggedMore", { count: warnings.more })}</p>}
        </div>
      )}
      {screen && warnings?.status === "unmatched" && <p className="text-sm text-muted-foreground">{w("none")}</p>}
      {screen && warnings?.status === "unavailable" && <p className="text-sm text-muted-foreground">{w("error")}</p>}
      {screen && (
        <p className="text-xs text-muted-foreground">
          {w.rich("attribution", {
            link: (chunks) => (
              <a href={DTDD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
                {chunks}
              </a>
            ),
          })}
          {warnings?.status === "matched" && (
            <>
              {" · "}
              <a href={warnings.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {w("details")}
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
