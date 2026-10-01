"use client";

import { CheckIcon, SearchIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Celebration } from "@/components/celebration";
import { PaperCard } from "@/components/paper-card";
import { Sheet } from "@/components/sheet";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "@/components/title-search";
import type { SearchResult, SearchType, TitleKind } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { uuidv7 } from "@/core/ids";
import { commitBatches, importRecap, MATCH_BATCH, type ImportedTitle, type ImportRow } from "@/core/import/commit";
import { parseExport, wantedInZip, type ExportFile } from "@/core/import/detect";
import { IMPORT_MAX_ITEMS, IMPORT_SOURCES, importUnit, mergeItems, type FindKind, type ImportItem, type ImportSource, type ParsedImport } from "@/core/import/items";
import type { FilmMatch } from "@/core/import/match";
import { looksLikeGzip, looksLikeZip, readZipTexts, type InflateRaw } from "@/core/import/zip";
import { recapCardData } from "@/core/stats/recap";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** An item in the preview: what the catalogs found, and what the user picked (a match is picked for them). */
type Row = { item: ImportItem; match: FilmMatch; pick: SearchResult | null; skip: boolean };
type Outcome = {
  id: string;
  outcome: "added" | "updated" | "kept" | "failed";
  finished: boolean;
  episodes: number;
  reading: number;
  minutes: number;
  from: string | null;
  to: string | null;
  title?: { name: string; kind: TitleKind; posterUrl: string | null };
};
type Counts = Record<Outcome["outcome"], number> & { episodes: number; reading: number };
type Problem = "notExport" | "empty" | "unreadable" | "match" | "save" | "signedOut";
type Step =
  | { name: "pick" }
  | { name: "reading" }
  | { name: "matching"; done: number; waiting: boolean }
  | { name: "preview" }
  | { name: "saving"; done: number; total: number; waiting: boolean }
  | { name: "done"; counts: Counts };

const MATCH_PARALLEL = 3;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

const decompress = (format: "deflate-raw" | "gzip"): InflateRaw => async (bytes) => {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * The export, read on this device: a ZIP as it came (only the files an export needs are opened), MyAnimeList's
 * gzipped XML, or plain CSV / XML files. Null: not an export we know.
 */
async function readExport(files: readonly File[]): Promise<ParsedImport | null> {
  const texts: ExportFile[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) continue;
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
    let path = file.name;
    if (looksLikeGzip(bytes)) {
      bytes = await decompress("gzip")(bytes);
      path = path.replace(/\.gz$/i, "");
    }
    if (looksLikeZip(bytes)) {
      const inside = await readZipTexts(bytes, wantedInZip, decompress("deflate-raw"));
      for (const [p, text] of inside ?? []) texts.push({ path: p, text });
    } else {
      texts.push({ path, text: new TextDecoder().decode(bytes) });
    }
  }
  return parseExport(texts);
}

class ImportError extends Error {
  constructor(readonly problem: Problem) {
    super(problem);
  }
}

/**
 * POSTs JSON, riding out rate limits (waits for Retry-After, as often as needed) and brief outages (a few retries).
 * `onWait` says when it's waiting out a rate limit.
 */
async function post<T>(url: string, body: unknown, failure: Problem, onWait: (waiting: boolean) => void): Promise<T> {
  for (let attempt = 0; ; ) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (res?.ok) {
      onWait(false);
      return (await res.json()) as T;
    }
    if (res?.status === 401) throw new ImportError("signedOut");
    if (res?.status === 429) {
      onWait(true);
      await new Promise((resolve) => setTimeout(resolve, (Number(res.headers.get("Retry-After")) || 30) * 1000));
      continue;
    }
    if ((res && res.status < 500) || ++attempt > 3) throw new ImportError(failure);
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

/** Runs `fn` for each index with `parallel` at a time; stops at the first failure and rethrows it. */
async function inParallel(indices: readonly number[], parallel: number, fn: (index: number) => Promise<void>) {
  let next = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (failure === null && next < indices.length) {
      const index = indices[next++]!;
      try {
        await fn(index);
      } catch (error) {
        failure ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  if (failure !== null) throw failure;
}

const batchCount = (n: number, size: number) => Math.ceil(n / size);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const titleKey = (r: Pick<SearchResult, "kind" | "externalId">) => `${r.kind}:${r.externalId}`;
const isRead = (find: FindKind) => find === "book" || find === "manga";

/**
 * Import (S2 Letterboxd import, S3 import & export, ADR 0041): pick an export from Letterboxd, Goodreads,
 * MyAnimeList, TV Time or Mystonie → its titles found in the catalogs (only names, years, ISBNs and ids leave the
 * device) → a preview to check → saved in batches → the "Imported N films" card.
 */
export function ImportFlow({ username, host, from }: { username: string | null; host: string; from: ImportSource }) {
  const t = useTranslations("Import");
  const [source, setSource] = useState<ImportSource>(from);
  const [step, setStep] = useState<Step>({ name: "pick" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [have, setHave] = useState<Record<string, EntryStatus>>({});
  const [finding, setFinding] = useState<number | null>(null);
  const [imported, setImported] = useState<ImportedTitle[]>([]);
  const [celebrating, setCelebrating] = useState(false);

  // Work that survives a retry: which batches are done, and the rows being saved (stable ids make retries safe).
  const matches = useRef<(FilmMatch | undefined)[]>([]);
  const matchedBatches = useRef(new Set<number>());
  const saving = useRef<{ batches: ImportRow[][]; outcomes: Map<string, Outcome>; done: Set<number>; finished: boolean }>(null);

  const busy = step.name === "reading" || step.name === "matching" || step.name === "saving";
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const unit = useMemo(() => importUnit((parsed?.items ?? []).map((i) => i.find)), [parsed]);
  const things = (count: number) => t("things", { unit, count });

  async function pickFiles(files: readonly File[]) {
    if (files.length === 0) return;
    setProblem(null);
    setStep({ name: "reading" });
    let result: ParsedImport | null;
    try {
      result = await readExport(files);
    } catch (error) {
      console.error(error);
      setProblem("unreadable");
      return setStep({ name: "pick" });
    }
    if (!result || result.items.length === 0) {
      if (result) setSource(result.source);
      setProblem(result ? "empty" : "notExport");
      return setStep({ name: "pick" });
    }
    setSource(result.source);
    setParsed(result);
    matches.current = [];
    matchedBatches.current = new Set();
    setHave({});
    await findItems(result.items);
  }

  async function findItems(items: readonly ImportItem[]) {
    setProblem(null);
    const total = batchCount(items.length, MATCH_BATCH);
    const todo = range(total).filter((i) => !matchedBatches.current.has(i));
    const progress = () => Math.min(items.length, matchedBatches.current.size * MATCH_BATCH);
    let waiting = false;
    const onWait = (w: boolean) => {
      waiting = w;
      setStep({ name: "matching", done: progress(), waiting });
    };
    setStep({ name: "matching", done: progress(), waiting: false });
    try {
      await inParallel(todo, MATCH_PARALLEL, async (batch) => {
        const slice = items.slice(batch * MATCH_BATCH, (batch + 1) * MATCH_BATCH);
        const body = await post<{ matches: FilmMatch[]; have: Record<string, EntryStatus> }>(
          "/api/import/match",
          { items: slice.map((i) => i.query) },
          "match",
          onWait,
        );
        body.matches.forEach((m, i) => (matches.current[batch * MATCH_BATCH + i] = m));
        setHave((h) => ({ ...h, ...body.have }));
        matchedBatches.current.add(batch);
        setStep({ name: "matching", done: progress(), waiting });
      });
    } catch (error) {
      setProblem(error instanceof ImportError ? error.problem : "match");
      return;
    }
    setRows(
      items.map((item, i) => {
        const match = matches.current[i] ?? { state: "missing" };
        return { item, match, pick: match.state === "matched" ? match.match : null, skip: false };
      }),
    );
    setStep({ name: "preview" });
    window.scrollTo({ top: 0 });
  }

  /** The picked rows, one per title: rows that turned out to be the same title (anime seasons, one film twice) merge. */
  const picked = useMemo(() => {
    const groups = new Map<string, { pick: SearchResult; items: ImportItem[] }>();
    for (const r of rows) {
      if (!r.pick || r.skip) continue;
      const key = titleKey(r.pick);
      const group = groups.get(key) ?? { pick: r.pick, items: [] };
      group.items.push(r.item);
      groups.set(key, group);
    }
    return [...groups.values()].map((g) => ({ pick: g.pick, item: mergeItems(g.items, g.pick.kind), count: g.items.length }));
  }, [rows]);

  async function save() {
    if (!saving.current) {
      const all: ImportRow[] = picked.map(({ pick, item }) => ({
        id: uuidv7(),
        kind: pick.kind,
        externalId: pick.externalId,
        status: item.status,
        watchedOn: item.status === "finished" && !item.finishedAt ? item.watchedOn : null,
        finishedAt: item.status === "finished" ? item.finishedAt : null,
        undated: item.status === "finished" && !item.finishedAt && !item.watchedOn,
        rating: item.rating,
        review: item.review,
        // A game's hours only fit a game.
        hoursPlayed: pick.kind === "game" ? item.hoursPlayed : null,
        // Episodes only fit a series, reading logs only a book or manga (a pick of another kind drops them).
        episodes: pick.kind === "series" ? item.episodes : [],
        reading: pick.kind === "book" || pick.kind === "manga" ? item.reading.filter((l) => (pick.kind === "book") === (l.unit === "page")) : [],
      }));
      saving.current = { batches: commitBatches(all), outcomes: new Map(), done: new Set(), finished: false };
    }
    const job = saving.current;
    const total = job.batches.reduce((n, b) => n + b.length, 0);
    const progress = () => [...job.done].reduce((n, i) => n + job.batches[i]!.length, 0);
    let waiting = false;
    const onWait = (w: boolean) => {
      waiting = w;
      setStep({ name: "saving", done: progress(), total, waiting });
    };
    setProblem(null);
    setStep({ name: "saving", done: progress(), total, waiting: false });
    try {
      const todo = range(job.batches.length).filter((i) => !job.done.has(i));
      // One at a time: each batch is a burst of catalog calls and writes.
      await inParallel(todo, 1, async (batch) => {
        const body = await post<{ results: Outcome[] }>("/api/import/commit", { rows: job.batches[batch] }, "save", onWait);
        for (const o of body.results) job.outcomes.set(o.id, o);
        job.done.add(batch);
        setStep({ name: "saving", done: progress(), total, waiting });
      });
      if (!job.finished) {
        await post("/api/import/commit", { rows: [], done: true }, "save", onWait);
        job.finished = true;
      }
    } catch (error) {
      setProblem(error instanceof ImportError ? error.problem : "save");
      return;
    }

    const counts: Counts = { added: 0, updated: 0, kept: 0, failed: 0, episodes: 0, reading: 0 };
    const brought: ImportedTitle[] = [];
    const ratings = new Map(job.batches.flat().map((r) => [r.id, r.rating]));
    for (const row of job.batches.flat()) {
      const o = job.outcomes.get(row.id);
      counts[o?.outcome ?? "failed"] += 1;
      if (!o) continue;
      counts.episodes += o.episodes;
      counts.reading += o.reading;
      if (o.title && o.from && o.to && (o.finished || o.episodes > 0 || o.reading > 0)) {
        brought.push({ ...o.title, minutes: o.minutes, episodes: o.episodes, finished: o.finished, rating: ratings.get(row.id) ?? null, from: o.from, to: o.to });
      }
    }
    setImported(brought);
    setStep({ name: "done", counts });
    setCelebrating(brought.length > 0);
    track("import_done", {
      source: parsed?.source ?? source,
      titles: rows.length,
      auto: rows.filter((r) => r.match.state === "matched").length,
      added: counts.added,
    });
    window.scrollTo({ top: 0 });
  }

  function reset() {
    saving.current = null;
    setRows([]);
    setParsed(null);
    setImported([]);
    setProblem(null);
    setStep({ name: "pick" });
  }

  const recap = useMemo(() => importRecap(imported), [imported]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-12 pb-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        {(step.name === "pick" || step.name === "reading") && <p className="max-w-prose text-muted-foreground">{t("intro")}</p>}
      </header>

      {(step.name === "pick" || step.name === "reading") && (
        <PickExport source={source} onSource={setSource} reading={step.name === "reading"} problem={problem} onPick={pickFiles} />
      )}

      {step.name === "matching" && parsed && (
        <Progress
          label={t("matching", { done: step.done, total: parsed.items.length })}
          done={step.done}
          total={parsed.items.length}
          waiting={step.waiting}
          problem={problem}
          onRetry={() => findItems(parsed.items)}
        />
      )}

      {step.name === "preview" && parsed && (
        <Preview
          rows={rows}
          have={have}
          parsed={parsed}
          things={things}
          count={picked.length}
          onChange={(i, row) => setRows((list) => list.map((r, j) => (j === i ? row : r)))}
          onFind={setFinding}
          onImport={save}
        />
      )}

      {step.name === "saving" && (
        <Progress
          label={t("saving", { done: step.done, total: step.total })}
          done={step.done}
          total={step.total}
          waiting={step.waiting}
          problem={problem}
          onRetry={save}
        />
      )}

      {step.name === "done" && (
        <Done counts={step.counts} things={things} canCelebrate={recap !== null} onCelebrate={() => setCelebrating(true)} onAgain={reset} />
      )}

      {finding !== null && rows[finding] && (
        <FindTitle
          item={rows[finding].item}
          onClose={() => setFinding(null)}
          onPick={(pick) => {
            setRows((list) => list.map((r, j) => (j === finding ? { ...r, pick, skip: false } : r)));
            setFinding(null);
          }}
        />
      )}

      {celebrating && recap && (
        <Celebration data={recapCardData(recap)} source={{ kind: "stats", ready: true }} animate username={username} host={host} onClose={() => setCelebrating(false)} />
      )}
    </main>
  );
}

function PickExport(props: {
  source: ImportSource;
  onSource: (source: ImportSource) => void;
  reading: boolean;
  problem: Problem | null;
  onPick: (files: File[]) => void;
}) {
  const t = useTranslations("Import");
  const [over, setOver] = useState(false);
  const { source, reading } = props;
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("fromLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {IMPORT_SOURCES.map((s) => (
            <label
              key={s}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold ring-1 ring-border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand hover:bg-muted",
                s === source && "bg-brand-soft ring-2 ring-brand hover:bg-brand-soft",
              )}
            >
              <input type="radio" name="import-source" value={s} checked={s === source} onChange={() => props.onSource(s)} className="sr-only" />
              {t(`sources.${s}.name`)}
            </label>
          ))}
        </div>
      </fieldset>
      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("howTitle", { source: t(`sources.${source}.name`) })}</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>{t(`sources.${source}.how1`)}</li>
          <li>{t(`sources.${source}.how2`)}</li>
        </ol>
        <p className="mt-3 font-hand text-lg text-muted-foreground">{t(`sources.${source}.brings`)}</p>
      </PaperCard>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!reading) props.onPick([...e.dataTransfer.files]);
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-10 text-center transition-colors focus-within:border-brand hover:border-brand/60",
          over && "border-brand bg-brand-soft/40",
          reading && "pointer-events-none opacity-70",
        )}
      >
        <span aria-hidden="true" className="absolute -top-3 left-8 h-6 w-20 -rotate-3 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
        <UploadIcon className="size-8 text-brand" aria-hidden="true" />
        <span className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground shadow-sm">
          {reading ? t("reading") : t("pick")}
        </span>
        <span className="font-hand text-xl text-muted-foreground">{t("dropHint")}</span>
        <input
          type="file"
          accept=".zip,.csv,.xml,.gz,application/zip,text/csv,text/xml,application/xml,application/gzip"
          multiple
          disabled={reading}
          className="sr-only"
          onChange={(e) => {
            props.onPick([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      <p role="alert" className="min-h-5 text-sm font-medium text-destructive">
        {props.problem && t(`problem.${props.problem}`)}
      </p>
      <p className="text-xs text-muted-foreground">{t("privacy")}</p>
    </>
  );
}

function Progress(props: { label: string; done: number; total: number; waiting: boolean; problem: Problem | null; onRetry: () => void }) {
  const t = useTranslations("Import");
  const pct = props.total ? Math.round((props.done / props.total) * 100) : 0;
  return (
    <PaperCard>
      <p aria-live="polite" className="font-display text-lg font-bold">
        {props.label}
      </p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{props.waiting ? t("waiting") : t("stayHere")}</p>
      {props.problem && (
        <div role="alert" className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm font-medium text-destructive">{t(`problem.${props.problem}`)}</p>
          {props.problem !== "signedOut" && (
            <button type="button" onClick={props.onRetry} className="h-11 rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted">
              {t("retry")}
            </button>
          )}
        </div>
      )}
    </PaperCard>
  );
}

function Preview(props: {
  rows: Row[];
  have: Record<string, EntryStatus>;
  parsed: ParsedImport;
  things: (count: number) => string;
  count: number;
  onChange: (index: number, row: Row) => void;
  onFind: (index: number) => void;
  onImport: () => void;
}) {
  const t = useTranslations("Import");
  const format = useFormatter();
  const indexed = props.rows.map((row, index) => ({ row, index }));
  const check = indexed.filter(({ row }) => row.match.state === "ambiguous");
  const missing = indexed.filter(({ row }) => row.match.state === "missing");
  const ready = indexed.filter(({ row }) => row.match.state === "matched");
  const already = props.rows.filter((r) => r.pick && !r.skip && props.have[titleKey(r.pick)]).length;
  const merged = props.rows.filter((r) => r.pick && !r.skip).length - props.count;
  const { cut } = props.parsed;
  const row = ({ row: r, index }: { row: Row; index: number }, children?: ReactNode) => (
    <ItemRow key={r.item.key} row={r} have={props.have} onChange={(next) => props.onChange(index, next)} onFind={() => props.onFind(index)}>
      {children}
    </ItemRow>
  );

  return (
    <>
      <PaperCard stamp={t("previewStamp")}>
        <h2 className="pr-24 font-display text-2xl font-extrabold tracking-[-0.02em]">{t("previewTitle", { things: props.things(props.rows.length) })}</h2>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["statReady", ready.length],
              ["statCheck", check.length],
              ["statMissing", missing.length],
            ] as const
          ).map(([key, n]) => (
            <div key={key} className="rounded-xl bg-muted/60 px-2 py-3">
              <dd className="font-display text-2xl font-extrabold tabular-nums">{format.number(n)}</dd>
              <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            </div>
          ))}
        </dl>
        {cut > 0 && <p className="mt-4 text-sm text-muted-foreground">{t("cut", { total: props.rows.length + cut, max: IMPORT_MAX_ITEMS })}</p>}
        {already > 0 && <p className="mt-4 text-sm text-muted-foreground">{t("haveNote", { count: already })}</p>}
        {merged > 0 && <p className="mt-4 text-sm text-muted-foreground">{t("mergedNote", { count: merged })}</p>}
      </PaperCard>

      {check.length > 0 && (
        <Group title={t("checkTitle")} body={t("checkBody")}>
          {check.map((entry) =>
            row(
              entry,
              entry.row.match.state === "ambiguous" && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {entry.row.match.candidates.map((c) => (
                    <button
                      key={titleKey(c)}
                      type="button"
                      aria-pressed={!!entry.row.pick && titleKey(entry.row.pick) === titleKey(c)}
                      onClick={() => props.onChange(entry.index, { ...entry.row, pick: c, skip: false })}
                      className={cn(
                        "flex w-20 shrink-0 flex-col gap-1 rounded-lg p-1 text-left ring-1 ring-border",
                        entry.row.pick && titleKey(entry.row.pick) === titleKey(c) && "bg-brand-soft/60 ring-2 ring-brand",
                      )}
                    >
                      <Poster url={c.imageUrl} />
                      <span className="line-clamp-2 text-xs font-medium">{c.name}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{c.creator ?? c.year ?? "—"}</span>
                    </button>
                  ))}
                </div>
              ),
            ),
          )}
        </Group>
      )}

      {missing.length > 0 && (
        <Group title={t("missingTitle")} body={t("missingBody")}>
          {missing.map((entry) => row(entry))}
        </Group>
      )}

      {ready.length > 0 && (
        <details className="group rounded-2xl ring-1 ring-border" open={ready.length <= 20}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-lg font-bold">
            {t("readyTitle", { count: ready.length })}
            <span className="text-sm font-normal text-muted-foreground group-open:hidden">{t("show")}</span>
          </summary>
          <p className="px-4 text-sm text-muted-foreground">{t("readyBody")}</p>
          <ul className="flex flex-col divide-y divide-dashed divide-border px-4 pb-2">{ready.map((entry) => row(entry))}</ul>
        </details>
      )}

      {/* Sticks to the bottom while the list scrolls, above the nav island (`--island-space`, ADR 0050), and settles
          under the list at the end (never over the footer). */}
      <div className="sticky bottom-[calc(var(--island-space)-0.75rem)] z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled={props.count === 0}
            onClick={props.onImport}
            className="h-12 w-full rounded-2xl bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50 sm:w-auto"
          >
            {props.count === 0 ? t("importNone") : t("importButton", { things: props.things(props.count) })}
          </button>
        </div>
      </div>
    </>
  );
}

function Group({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      <ul className="mt-2 flex flex-col divide-y divide-dashed divide-border rounded-2xl bg-card px-4 ring-1 ring-border">{children}</ul>
    </section>
  );
}

function Poster({ url, className }: { url: string | undefined; className?: string }) {
  return (
    <span className={cn("relative block aspect-[2/3] w-full overflow-hidden rounded-md bg-muted ring-1 ring-black/5", className)}>
      {url && <Image src={url} alt="" fill unoptimized sizes="80px" className="object-cover" />}
    </span>
  );
}

/** What the export says about an item, in a line: "Watched 4 Mar 2024 · ★ 4.5", "Reading · chapter 112", "Watchlist". */
function ItemFacts({ item }: { item: ImportItem }) {
  const t = useTranslations("Import");
  const format = useFormatter();
  const read = isRead(item.find);
  const day = item.finishedAt ?? (item.watchedOn ? `${item.watchedOn}T12:00:00Z` : null);
  const date = day ? format.dateTime(new Date(day), { dateStyle: "medium", timeZone: item.finishedAt ? undefined : "UTC" }) : null;
  const facts: string[] = [];
  if (item.status === "finished") facts.push(date ? t(read ? "readOn" : "watchedOn", { date }) : t("finishedUndated"));
  else facts.push(t(item.status === "watching" ? (read ? "reading" : "watching") : read ? "wantRead" : "watchlist"));
  if (item.episodes.length > 0) facts.push(t("episodes", { count: item.episodes.length }));
  const furthest = item.reading.reduce<ImportItem["reading"][number] | null>((a, b) => (!a || b.position > a.position ? b : a), null);
  if (furthest) facts.push(t("readingAt", { unit: furthest.unit, position: furthest.position }));
  if (item.rating !== null) facts.push(t("rating", { rating: item.rating }));
  return <p className="text-xs text-muted-foreground">{facts.join(" · ")}</p>;
}

/** One item: what the export says, what it'll be saved as, and the controls to fix it. */
function ItemRow({
  row,
  have,
  onChange,
  onFind,
  children,
}: {
  row: Row;
  have: Record<string, EntryStatus>;
  onChange: (row: Row) => void;
  onFind: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("Import");
  const { item, pick } = row;
  const included = !!pick && !row.skip;
  const matched = row.match.state === "matched";

  return (
    <li className={cn("py-3", row.skip && "opacity-60")}>
      <div className="flex items-start gap-3">
        {matched ? (
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => onChange({ ...row, skip: !e.target.checked })}
            aria-label={t("include", { name: item.name })}
            className="mt-3 size-5 shrink-0 accent-brand"
          />
        ) : null}
        <Poster url={pick?.imageUrl} className="w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">
            {item.name}
            {item.year !== null && <span className="text-muted-foreground"> ({item.year})</span>}
          </p>
          {item.author && <p className="text-xs text-muted-foreground">{item.author}</p>}
          <ItemFacts item={item} />
          {pick && (!matched || normalized(pick.name) !== normalized(item.name)) && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <CheckIcon className="size-3.5" aria-hidden="true" />
              {t("picked", { name: pick.name, year: pick.year ?? "—" })}
            </p>
          )}
          {pick && have[titleKey(pick)] && (
            <span className="mt-1 ml-1 inline-block -rotate-2 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold">{t("have")}</span>
          )}
        </div>
        {!matched && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button type="button" onClick={onFind} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-border hover:bg-muted">
              <SearchIcon className="size-4" aria-hidden="true" />
              {t("findIt")}
            </button>
            {pick && (
              <button type="button" onClick={() => onChange({ ...row, pick: null })} className="h-9 px-2 text-xs text-muted-foreground underline-offset-4 hover:underline">
                {t("leaveOut")}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

const normalized = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

/** Which search "Find it" runs, and which results fit. */
function findSearch(find: FindKind): { type: SearchType; fits: (r: SearchResult) => boolean } {
  if (find === "book" || find === "manga") return { type: find, fits: (r) => r.kind === find };
  if (find === "screen") return { type: "screen", fits: (r) => r.kind === "movie" || r.kind === "series" };
  return { type: "screen", fits: (r) => r.kind === find };
}

/** "Find it": search the catalog for an item the import couldn't place. */
function FindTitle({ item, onPick, onClose }: { item: ImportItem; onPick: (pick: SearchResult) => void; onClose: () => void }) {
  const t = useTranslations("Import");
  const [query, setQuery] = useState(item.name);
  const { type, fits } = findSearch(item.find);
  const search = useTitleSearch(query, type);
  const results = search.status === "done" ? search.results.filter(fits) : [];
  return (
    <Sheet open onClose={onClose} title={t("findTitle", { name: item.name })} closeLabel={t("close")}>
      <label className="flex flex-col gap-2">
        <span className="sr-only">{t("findLabel")}</span>
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      </label>
      <SearchStatus query={query} search={search} />
      {query.trim().length >= MIN_SEARCH_CHARS && results.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {results.map((r) => (
            <li key={titleKey(r)}>
              <PosterButton result={r} onPick={onPick} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function Done(props: { counts: Counts; things: (count: number) => string; canCelebrate: boolean; onCelebrate: () => void; onAgain: () => void }) {
  const t = useTranslations("Import");
  const { counts } = props;
  const lines = (["added", "updated", "kept", "failed"] as const).filter((k) => counts[k] > 0);
  return (
    <PaperCard stamp={t("doneStamp")}>
      <h2 className="pr-24 font-display text-2xl font-extrabold tracking-[-0.02em]">{t("doneTitle")}</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {lines.map((k) => (
          <li key={k} className={cn("font-hand text-2xl", k === "failed" && "text-destructive")}>
            {t(`done.${k}`, { things: props.things(counts[k]), count: counts[k] })}
          </li>
        ))}
        {counts.episodes > 0 && <li className="font-hand text-2xl">{t("done.episodes", { count: counts.episodes })}</li>}
        {counts.reading > 0 && <li className="font-hand text-2xl">{t("done.reading", { count: counts.reading })}</li>}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/collection" className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90">
          {t("seeCollection")}
        </Link>
        {props.canCelebrate && (
          <button type="button" onClick={props.onCelebrate} className="h-12 rounded-2xl px-5 font-semibold ring-1 ring-border hover:bg-muted">
            {t("makeCard")}
          </button>
        )}
        <button type="button" onClick={props.onAgain} className="h-12 rounded-2xl px-5 text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("again")}
        </button>
      </div>
    </PaperCard>
  );
}
