"use client";

import { EyeIcon, PencilLineIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { CountrySearch } from "@/components/atlas/country-search";
import { Sheet } from "@/components/sheet";
import { MIN_SEARCH_CHARS, SearchStatus, useTitleSearch } from "@/components/title-search";
import type { CountryCode } from "@/core/countries";
import { uuidv7 } from "@/core/ids";
import { JOURNAL_TAGS, JOURNAL_TAGS_MAX, parseWriterBody, type JournalTag } from "@/core/journal";
import { articlePath } from "@/core/journal-feed";
import { POST_BODY_MAX, POST_DESCRIPTION_MAX, POST_SUBJECTS_MAX, POST_TITLE_MAX, type PostState } from "@/core/journal-posts";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ArticleBlocks } from "./article-blocks";
import { PassportStamp } from "./passport-stamp";

/** A subject as the editor shows it: its key (`movie:603`, `place:JP`), name and picture (a poster, or a country's stamp). */
export type EditorSubject = { key: string; name: string; posterUrl: string | null; country: string | null };

export type EditorPost = {
  id: string | null;
  locale: string;
  title: string;
  description: string;
  body: string;
  tags: JournalTag[];
  subjects: EditorSubject[];
  spoilers: boolean;
  feature: boolean;
  state: PostState | null;
};

type Saved = { state: PostState; id: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; saved: Saved } | { kind: "error"; problem: string } | { kind: "deleted" };

const length = (s: string) => [...s].length;

/**
 * Writing a Journal article (stage 4, ADR 0092), phone first: title, a line under it, what it's about (titles from
 * the catalogs' search, or countries), 1 to 3 categories, the text with a live preview, spoilers, the language, and
 * "Send it to be Featured". Saves as a draft or publishes through PUT /api/journal/posts; the database decides
 * when it's published and sends a changed Featured article back to the team.
 */
export function PostEditor({
  initial,
  locales,
  countries,
  privatePage,
}: {
  initial: EditorPost;
  locales: readonly { code: string; name: string }[];
  countries: readonly (readonly [CountryCode, string, string])[];
  privatePage: boolean;
}) {
  const t = useTranslations("JournalWrite");
  const tj = useTranslations("Journal");
  const router = useRouter();
  const ids = useId();
  // A new article gets its id here, so a second save updates the same one (UUID v7, day-one rule).
  const [id] = useState(() => initial.id ?? uuidv7());
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [body, setBody] = useState(initial.body);
  const [tags, setTags] = useState<JournalTag[]>(initial.tags);
  const [subjects, setSubjects] = useState<EditorSubject[]>(initial.subjects);
  const [spoilers, setSpoilers] = useState(initial.spoilers);
  const [locale, setLocale] = useState(initial.locale);
  const [feature, setFeature] = useState(initial.feature);
  const [state, setState] = useState<PostState | null>(initial.state);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  const published = state !== null && state !== "draft";
  const blocks = useMemo(() => (mode === "preview" ? parseWriterBody(body) : []), [mode, body]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
      if (status.kind === "saved" || status.kind === "error") setStatus({ kind: "idle" });
    };

  async function save(publish: boolean) {
    setStatus({ kind: "saving" });
    const res = await fetch("/api/journal/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, locale, title, description, body, tags, subjects: subjects.map((s) => s.key), spoilers, publish, feature: publish && feature }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { post?: Saved; error?: string } | null;
    if (!res?.ok || !json?.post) {
      setStatus({ kind: "error", problem: json?.error ?? "other" });
      return;
    }
    setState(json.post.state);
    setDirty(false);
    setStatus({ kind: "saved", saved: json.post });
    // A new article's address becomes its edit page, without reloading the editor (a reload edits the same one).
    if (!initial.id) window.history.replaceState(null, "", `?id=${id}`);
  }

  async function remove() {
    setConfirmDelete(false);
    setStatus({ kind: "saving" });
    const res = await fetch(`/api/journal/posts?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok && res?.status !== 404) {
      setStatus({ kind: "error", problem: "other" });
      return;
    }
    setDirty(false);
    setStatus({ kind: "deleted" });
    router.replace("/me/journal");
  }

  const saving = status.kind === "saving";
  const savedMessage =
    status.kind === "saved" ? (status.saved.state === "draft" ? t("savedDraft") : status.saved.state === "pending" ? t("savedPending") : t("savedPublished")) : null;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
    >
      <Field label={t("titleLabel")} htmlFor={`${ids}-title`} count={t("count", { count: length(title), max: POST_TITLE_MAX })}>
        <input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => edit(setTitle)(e.target.value)}
          maxLength={POST_TITLE_MAX}
          required
          placeholder={t("titlePlaceholder")}
          className="h-14 w-full rounded-2xl bg-card px-4 font-display text-xl font-extrabold ring-1 ring-border outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
        />
      </Field>

      <Field label={t("descriptionLabel")} htmlFor={`${ids}-description`} count={t("count", { count: length(description), max: POST_DESCRIPTION_MAX })}>
        <input
          id={`${ids}-description`}
          value={description}
          onChange={(e) => edit(setDescription)(e.target.value)}
          maxLength={POST_DESCRIPTION_MAX}
          placeholder={t("descriptionPlaceholder")}
          className="h-12 w-full rounded-2xl bg-card px-4 ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
        />
      </Field>

      <SubjectPicker subjects={subjects} onChange={edit(setSubjects)} countries={countries} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-baseline justify-between gap-2 font-semibold">
          {t("tagsLabel")}
          <span className="text-sm font-normal text-muted-foreground">{t("tagsHint")}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {JOURNAL_TAGS.map((tag) => {
            const on = tags.includes(tag);
            const full = !on && tags.length >= JOURNAL_TAGS_MAX;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => edit(setTags)(on ? tags.filter((x) => x !== tag) : [...tags, tag])}
                className={cn(
                  "flex h-10 items-center rounded-full px-4 text-sm font-bold ring-1 transition-colors press disabled:opacity-40",
                  on ? "bg-brand text-brand-foreground ring-brand" : "bg-card ring-border hover:ring-brand/50",
                )}
              >
                {tj("tag", { tag })}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={`${ids}-body`} className="font-semibold">
            {t("bodyLabel")}
          </label>
          <div role="tablist" aria-label={t("modeLabel")} className="flex rounded-full bg-muted p-1">
            {(["write", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {m === "write" ? <PencilLineIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}
                {m === "write" ? t("writeTab") : t("previewTab")}
              </button>
            ))}
          </div>
        </div>
        {mode === "write" ? (
          <>
            <textarea
              id={`${ids}-body`}
              value={body}
              onChange={(e) => edit(setBody)(e.target.value)}
              maxLength={POST_BODY_MAX}
              rows={14}
              placeholder={t("bodyPlaceholder")}
              className="field-sizing-content min-h-72 w-full rounded-2xl bg-card p-4 text-[17px] leading-relaxed ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
            />
            <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{t("bodyHint")}</span>
              <span>{t("count", { count: length(body), max: POST_BODY_MAX })}</span>
            </p>
          </>
        ) : (
          <div className="min-h-72 rounded-2xl bg-card p-4 ring-1 ring-border">
            {blocks.length ? <ArticleBlocks blocks={blocks} /> : <p className="text-muted-foreground">{t("previewEmpty")}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Toggle label={t("spoilersLabel")} hint={t("spoilersHint")} checked={spoilers} onChange={edit(setSpoilers)} />
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">{t("languageLabel")}</span>
          <select
            value={locale}
            onChange={(e) => edit(setLocale)(e.target.value)}
            className="h-11 rounded-full bg-muted px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <Toggle label={t("featureLabel")} hint={t("featureHint")} checked={feature} onChange={edit(setFeature)} />
        {state === "featured" && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">{t("featuredEdit")}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {t.rich("terms", {
            terms: (chunks) => (
              <Link href="/terms" className="underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
        {privatePage && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm">
            {t.rich("privatePage", {
              settings: (chunks) => (
                <Link href="/settings" className="font-semibold text-brand underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex h-12 items-center rounded-full bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press disabled:opacity-50"
          >
            {saving ? t("saving") : published ? t("update") : t("publish")}
          </button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void save(false)}
            className="flex h-12 items-center rounded-full bg-card px-5 font-bold ring-1 ring-border press disabled:opacity-50"
          >
            {published ? t("unpublish") : t("saveDraft")}
          </button>
          {state !== null && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              aria-label={t("delete")}
              className="ml-auto flex size-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Trash2Icon className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p aria-live="polite" className={cn("min-h-6 text-sm", status.kind === "error" ? "text-destructive" : "text-muted-foreground")}>
          {status.kind === "error" && t("error", { problem: status.problem })}
          {savedMessage}
          {status.kind === "saved" && status.saved.state !== "draft" && (
            <>
              {" "}
              <Link href={articlePath(id)} className="font-semibold text-brand underline underline-offset-2">
                {t("see")}
              </Link>
            </>
          )}
        </p>
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("deleteConfirm")} closeLabel={t("cancel")}>
        <div className="flex gap-2">
          <button type="button" onClick={() => void remove()} className="flex h-12 items-center rounded-full bg-destructive px-5 font-bold text-white press">
            {t("deleteYes")}
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="flex h-12 items-center rounded-full bg-card px-5 font-bold ring-1 ring-border press">
            {t("cancel")}
          </button>
        </div>
      </Sheet>
    </form>
  );
}

function Field({ label, htmlFor, count, children }: { label: string; htmlFor: string; count: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="font-semibold">
          {label}
        </label>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-6 shrink-0 accent-brand" />
    </label>
  );
}

/**
 * What the article is about (ADR 0092): titles found with the catalogs' search (every kind), or countries, up to
 * `POST_SUBJECTS_MAX`, shown as removable chips with their posters or a passport stamp.
 */
function SubjectPicker({
  subjects,
  onChange,
  countries,
}: {
  subjects: EditorSubject[];
  onChange: (subjects: EditorSubject[]) => void;
  countries: readonly (readonly [CountryCode, string, string])[];
}) {
  const t = useTranslations("JournalWrite");
  const tj = useTranslations("Journal");
  const ids = useId();
  const [tab, setTab] = useState<"titles" | "places">("titles");
  const [query, setQuery] = useState("");
  const search = useTitleSearch(query, "all");
  const full = subjects.length >= POST_SUBJECTS_MAX;
  const keys = new Set(subjects.map((s) => s.key));
  const add = (s: EditorSubject) => {
    if (!keys.has(s.key) && !full) onChange([...subjects, s]);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex w-full flex-col font-semibold">
        {t("aboutLabel")}
        <span className="text-sm font-normal text-muted-foreground">{t("aboutHint")}</span>
      </legend>

      {subjects.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <li key={s.key} className="flex items-center gap-2 rounded-full bg-card py-1 pr-1 pl-1 shadow-sm ring-1 ring-border">
              {s.country ? (
                <PassportStamp country={s.country} className="size-8 rotate-0 border-2 text-[7px]" />
              ) : (
                <span className="relative block h-9 w-6 overflow-hidden rounded bg-muted">
                  {s.posterUrl && <Image src={s.posterUrl} alt="" fill unoptimized sizes="24px" className="object-cover" />}
                </span>
              )}
              <span className="max-w-40 truncate text-sm font-semibold">{s.name}</span>
              <button
                type="button"
                onClick={() => onChange(subjects.filter((x) => x.key !== s.key))}
                aria-label={t("remove", { name: s.name })}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-muted-foreground">{t("aboutFull")}</p>
      ) : (
        <>
          <div role="tablist" aria-label={t("aboutLabel")} className="flex self-start rounded-full bg-muted p-1">
            {(["titles", "places"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => setTab(v)}
                className={cn("flex h-9 items-center rounded-full px-4 text-sm font-bold", tab === v ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {v === "titles" ? t("aboutTitles") : t("aboutPlaces")}
              </button>
            ))}
          </div>
          {tab === "titles" ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <label htmlFor={`${ids}-search`} className="sr-only">
                  {t("searchTitles")}
                </label>
                <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={`${ids}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchTitles")}
                  autoComplete="off"
                  enterKeyHint="search"
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="h-12 w-full rounded-full bg-card pr-4 pl-11 text-base ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <SearchStatus query={query} search={search} />
              {query.trim().length >= MIN_SEARCH_CHARS && search.status === "done" && search.results.length > 0 && (
                <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-2xl bg-card ring-1 ring-border">
                  {search.results.slice(0, 12).map((r) => {
                    const key = `${r.kind}:${r.externalId}`;
                    const picked = keys.has(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          disabled={picked}
                          onClick={() => {
                            add({ key, name: r.name, posterUrl: r.imageUrl ?? null, country: null });
                            setQuery("");
                          }}
                          className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                        >
                          <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded bg-muted">
                            {r.imageUrl && <Image src={r.imageUrl} alt="" fill unoptimized sizes="32px" className="object-cover" />}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="line-clamp-1 text-sm font-semibold">{r.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {tj("kind", { kind: r.kind })}
                              {r.year ? ` · ${r.year}` : null}
                              {r.creator ? ` · ${r.creator}` : null}
                            </span>
                          </span>
                          <PlusIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <CountrySearch
              options={countries}
              onPick={(code) => add({ key: `place:${code}`, name: countries.find(([c]) => c === code)?.[1] ?? code, posterUrl: null, country: code })}
            />
          )}
        </>
      )}
    </fieldset>
  );
}
