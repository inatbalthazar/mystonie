"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, GripVerticalIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Celebration } from "@/components/celebration";
import { loadRegionMap } from "@/components/atlas/region-map";
import { loadWorldMap } from "@/components/atlas/world-map";
import { isCardPosterUrl } from "@/core/catalog/images";
import type { SearchResult } from "@/core/catalog/types";
import { localDateString } from "@/core/cards/edit";
import type { CardData } from "@/core/cards/types";
import type { CountryCode } from "@/core/countries";
import {
  DEFAULT_TIERS,
  RANK_MAX,
  RANK_NOTE_MAX,
  RANK_TITLE_MAX,
  ROW_NAMES,
  TIER_ITEMS_MAX,
  TIERS_MAX,
  moveItem,
  moveToTier,
  parseRanking,
  parseRef,
  placeInTier,
  removeTier,
  shiftInTier,
  titleRef,
  type CardRanking,
  type RankItem,
} from "@/core/rankings";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { PlacePicker } from "./place-picker";
import { IconButton, Thumb } from "./rank-bits";
import { TierEditor, rowName } from "./tier-editor";
import { under, useDrag } from "./use-drag";
import { Sheet } from "../sheet";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "../title-search";

const DRAFT = "mystonie.rankDraft";

type Mode = "top" | "tier";

/** What's being made, kept on this device: both lists, so switching between them loses neither. */
type Draft = { mode: Mode; name: string; items: RankItem[]; tiers: string[]; tierItems: RankItem[] };

function readDraft(): Draft | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DRAFT) ?? "null") as Partial<Draft> | null;
    if (!raw || typeof raw !== "object") return null;
    const ranking = Array.isArray(raw.items) && raw.items.length > 0 ? parseRanking({ items: raw.items }) : null;
    const tiers =
      Array.isArray(raw.tiers) && raw.tiers.length >= 1 && raw.tiers.length <= TIERS_MAX
        ? raw.tiers.map((l) => (typeof l === "string" ? l : ""))
        : [...DEFAULT_TIERS];
    // Labels may be blank while being typed; the parser wants them filled.
    const tierRanking =
      Array.isArray(raw.tierItems) && raw.tierItems.length > 0 ? parseRanking({ items: raw.tierItems, tiers: tiers.map((_, i) => rowName(tiers, i)) }) : null;
    return {
      mode: raw.mode === "tier" ? "tier" : "top",
      name: typeof raw.name === "string" ? raw.name.slice(0, RANK_TITLE_MAX) : "",
      items: ranking?.items ?? [],
      tiers,
      tierItems: tierRanking?.items ?? [],
    };
  } catch {
    return null;
  }
}

/** The maps a place's outline needs, loaded well before the card is drawn: the world's, and each region's country's. */
function loadPlaceMaps(items: readonly RankItem[]) {
  for (const item of items) {
    const ref = parseRef(item.ref);
    if (ref?.type === "country") void loadWorldMap();
    if (ref?.type === "region") void loadRegionMap(ref.country as CountryCode).catch(() => {});
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT);
  } catch {
    // storage blocked: the list lasts while the page is open
  }
}

/**
 * Make a ranking (ADR 0099): a top list or a tier list. Name it if you like, then either add things one by one with ＋
 * (titles from every catalog, countries and their regions; seen or not), drag them into order (ADR 0100) and add a
 * line to any; or fill a tier list's rows, rename them, and drag things between them. The lists are
 * kept on this device until the card is made. The ✓ marks come from the server. `remix`, a shared ranking (step 4),
 * replaces the list of its kind; the other list stays as it was.
 */
export function RankMaker({ username, host, remix = null }: { username: string | null; host: string; remix?: { name: string; ranking: CardRanking } | null }) {
  const t = useTranslations("Rank");
  const [mode, setMode] = useState<Mode>("top");
  const [name, setName] = useState("");
  const [items, setItems] = useState<RankItem[]>([]);
  const [tiers, setTiers] = useState<string[]>([...DEFAULT_TIERS]);
  const [tierItems, setTierItems] = useState<RankItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The place (top list) or row (tier list) being filled.
  const [picking, setPicking] = useState<number | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const remixed = useRef(false);
  const tier = mode === "tier";
  const list = tier ? tierItems : items;
  const done = useDoneMarks(list);

  // The draft comes back after hydration (the server knows nothing of it).
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = readDraft();
      if (draft) {
        setMode(draft.mode);
        setName(draft.name);
        setItems(draft.items);
        setTiers(draft.tiers);
        setTierItems(draft.tierItems);
        loadPlaceMaps([...draft.items, ...draft.tierItems]);
      }
      if (remix && !remixed.current) {
        remixed.current = true;
        const { items: from, tiers: rows } = remix.ranking;
        setName(remix.name.slice(0, RANK_TITLE_MAX));
        if (rows) {
          setMode("tier");
          setTiers(rows);
          setTierItems(from);
        } else {
          setMode("top");
          setItems(from);
        }
        loadPlaceMaps(from);
        track("ranking_remixed", { type: rows ? "tier" : "top" });
        // Once in the draft, a reload keeps your changes instead of starting over from the shared list.
        window.history.replaceState(null, "", window.location.pathname);
      }
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [remix]);
  useEffect(() => {
    if (loaded) writeDraft(items.length || tierItems.length || name ? { mode, name, items, tiers, tierItems } : null);
  }, [loaded, mode, name, items, tiers, tierItems]);

  const listName = name.trim() || (tier ? t("tierDefaultName") : t("defaultName", { count: items.length }));

  /** Switches between a top list and a tier list. An empty one starts from the other's things. */
  function switchMode(next: Mode) {
    if (next === mode) return;
    setSelected(null);
    if (next === "tier" && tierItems.length === 0) setTierItems(items.map((i) => ({ ...i, note: null, tier: 0 })));
    if (next === "top" && items.length === 0 && tierItems.length > 0) {
      const sorted = [...tierItems].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0)).slice(0, RANK_MAX);
      setItems(sorted.map((i) => ({ ...i, tier: undefined })));
    }
    setMode(next);
  }

  function add(item: RankItem) {
    if (tier) {
      const row = picking ?? 0;
      setTierItems((cur) => (cur.some((i) => i.ref === item.ref) || cur.length >= TIER_ITEMS_MAX ? cur : [...cur, { ...item, tier: row }]));
    } else {
      setItems((cur) => (cur.some((i) => i.ref === item.ref) || cur.length >= RANK_MAX ? cur : [...cur, item]));
    }
    loadPlaceMaps([item]);
    setPicking(null);
  }

  function make() {
    const ranked = list.map((i) => ({ ...i, done: done.has(i.ref) }));
    const ranking = tier ? { items: ranked, tiers: tiers.map((_, i) => rowName(tiers, i)) } : { items: ranked };
    setCard({ kind: "movie", name: listName, posterUrl: null, finishedOn: localDateString(new Date()), ranking });
    track("ranking_made", { count: list.length, type: mode });
  }

  function clear() {
    setName("");
    setSelected(null);
    if (tier) {
      setTierItems([]);
      setTiers([...DEFAULT_TIERS]);
    } else setItems([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t("modeLabel")} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["top", "tier"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            className="min-h-11 rounded-full text-sm font-semibold text-muted-foreground transition-colors aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-brand/60"
          >
            {t(value === "top" ? "modeTop" : "modeTier")}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("nameLabel")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, RANK_TITLE_MAX))}
          placeholder={tier ? t("tierNamePlaceholder") : t("namePlaceholder", { count: items.length || 10 })}
          maxLength={RANK_TITLE_MAX}
          className="h-12 rounded-xl border border-input bg-card px-4 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      </label>

      {tier ? (
        <TierEditor
          tiers={tiers}
          items={tierItems}
          done={done}
          selected={selected}
          onSelect={setSelected}
          onLabel={(row, label) => setTiers((cur) => cur.map((l, i) => (i === row ? label : l)))}
          onAddRow={() => setTiers((cur) => (cur.length < TIERS_MAX ? [...cur, ROW_NAMES[cur.length] ?? ""] : cur))}
          onRemoveRow={(row) => {
            const next = removeTier({ items: tierItems, tiers }, row);
            setTiers(next.tiers);
            setTierItems(next.items);
          }}
          onPick={setPicking}
          onMoveTo={(ref, row) => setTierItems((cur) => moveToTier(cur, ref, row))}
          onShift={(ref, by) => setTierItems((cur) => shiftInTier(cur, ref, by))}
          onPlace={(ref, row, before) => setTierItems((cur) => placeInTier(cur, ref, row, before))}
          onRemove={(ref) => {
            setTierItems((cur) => cur.filter((i) => i.ref !== ref));
            setSelected(null);
          }}
        />
      ) : (
        <TopList
          items={items}
          done={done}
          onItems={setItems}
          onAdd={() => setPicking(items.length)}
        />
      )}

      <div className="flex items-start gap-3">
        <p className="flex flex-1 items-start gap-2 text-sm text-muted-foreground">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          {t("doneHint")}
        </p>
        {/* Away from the card button: it empties the list. */}
        {list.length > 0 && (
          <button type="button" onClick={clear} className="-mt-2.5 min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            {t("clear")}
          </button>
        )}
      </div>

      {/* Leaves room for the getting-started button, which floats at the same height on the right while it's shown. */}
      <div className="sticky bottom-[calc(var(--island-space)+0.5rem)] z-10 flex [body:has([data-getting-started])_&]:pr-[4.25rem]">
        <button
          type="button"
          onClick={make}
          disabled={list.length === 0}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 text-lg font-bold whitespace-nowrap text-brand-foreground shadow-md hover:bg-brand/90 disabled:opacity-50 press"
        >
          <SparklesIcon className="size-5" aria-hidden="true" />
          {t("make")}
        </button>
      </div>

      <PickSheet
        title={picking === null ? null : tier ? t("rowAdd", { tier: rowName(tiers, picking) }) : t("pickTitle", { rank: picking + 1 })}
        taken={new Set(list.map((i) => i.ref))}
        onPick={add}
        onClose={() => setPicking(null)}
      />
      {card && <Celebration data={card} source={{ kind: tier ? "tier_list" : "ranking", ready: true }} username={username} host={host} onClose={() => setCard(null)} />}
    </div>
  );
}

/** The ✓ marks for these items, asked of the server whenever the list changes (ADR 0099). */
function useDoneMarks(items: readonly RankItem[]): ReadonlySet<string> {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const refs = items.map((i) => i.ref).join("|");
  useEffect(() => {
    if (!refs) return;
    const controller = new AbortController();
    fetch("/api/rankings/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs: refs.split("|") }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ done: string[] }>) : null))
      .then((body) => body && setDone(new Set(body.done)))
      .catch(() => {});
    return () => controller.abort();
  }, [refs]);
  return done;
}

function Rank({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <span className={cn("w-8 shrink-0 text-center font-display text-2xl font-extrabold tabular-nums", muted ? "text-muted-foreground/60" : "text-brand")}>{n}</span>
  );
}

/**
 * The top list being made: its things in order and one ＋ at the end for the next (ADR 0100). A thing is dragged into
 * place by its grip, or anywhere on it with a finger held a moment; on the grip, the arrow keys move it too.
 */
function TopList({
  items,
  done,
  onItems,
  onAdd,
}: {
  items: RankItem[];
  done: ReadonlySet<string>;
  onItems: Dispatch<SetStateAction<RankItem[]>>;
  onAdd: () => void;
}) {
  const t = useTranslations("Rank");
  const drag = useDrag({
    onMove: (ref, x, y) => {
      const row = under(x, y, "[data-rank-row]");
      if (!row) return;
      const to = Number(row.dataset.rankRow);
      const rect = row.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      // Past the middle of the row it's over, so rows of different heights don't swap back and forth.
      onItems((cur) => {
        const from = cur.findIndex((i) => i.ref === ref);
        if (from < 0 || from === to || (to > from ? y < middle : y > middle)) return cur;
        return moveItem(cur, from, to);
      });
    },
  });
  const move = (from: number, by: 1 | -1) => onItems((cur) => moveItem(cur, from, from + by));

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ol className="flex flex-col gap-2">
          {items.map((item, i) => (
            <Row
              key={item.ref}
              item={item}
              rank={i + 1}
              done={done.has(item.ref)}
              first={i === 0}
              last={i === items.length - 1}
              dragged={drag.dragging === item.ref}
              bind={drag.bind}
              onMove={(by) => move(i, by)}
              onRemove={() => onItems((cur) => cur.filter((x) => x.ref !== item.ref))}
              onNote={(note) => onItems((cur) => cur.map((x) => (x.ref === item.ref ? { ...x, note } : x)))}
            />
          ))}
        </ol>
      )}
      {items.length < RANK_MAX ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 px-4 text-left font-semibold text-brand hover:border-brand hover:bg-brand-soft/40 press"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <PlusIcon className="size-5" strokeWidth={2.6} aria-hidden="true" />
          </span>
          {t("slotEmpty", { rank: items.length + 1 })}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t("topFull", { max: RANK_MAX })}</p>
      )}
      {items.length > 1 && <p className="text-sm text-muted-foreground">{t("dragHint")}</p>}
      {drag.ghost((ref) => {
        const at = items.findIndex((i) => i.ref === ref);
        const item = items[at];
        return (
          item && (
            <div className="flex size-full items-center gap-1 rounded-2xl bg-card p-2 pl-8 ring-2 ring-brand">
              <Rank n={at + 1} />
              <Thumb item={item} />
              <span className="ml-1 truncate font-semibold">{item.name}</span>
            </div>
          )
        );
      })}
    </div>
  );
}

function Row({
  item,
  rank,
  done,
  first,
  last,
  dragged,
  bind,
  onMove,
  onRemove,
  onNote,
}: {
  item: RankItem;
  rank: number;
  done: boolean;
  first: boolean;
  last: boolean;
  dragged: boolean;
  bind: ReturnType<typeof useDrag>["bind"];
  onMove: (by: 1 | -1) => void;
  onRemove: () => void;
  onNote: (note: string) => void;
}) {
  const t = useTranslations("Rank");
  const place = item.kind === "country" || item.kind === "region";
  const [noting, setNoting] = useState(!!item.note);
  return (
    <li
      data-rank-row={rank - 1}
      {...bind(item.ref)}
      className={cn(
        "flex flex-col gap-2 rounded-2xl bg-card py-2 pr-1 shadow-sm ring-1 ring-border select-none [-webkit-touch-callout:none]",
        // Where it will land, while its copy is under the finger.
        dragged && "opacity-35 ring-2 ring-brand",
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-drag-handle
          {...bind(item.ref, { handle: true })}
          aria-label={t("dragHandle", { name: item.name })}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            if (e.key === "ArrowUp" ? !first : !last) onMove(e.key === "ArrowUp" ? -1 : 1);
          }}
          className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-5" aria-hidden="true" />
        </button>
        <Rank n={rank} />
        <Thumb item={item} />
        <span className="ml-1 flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{item.name}</span>
            {done && (
              <span className="flex shrink-0 items-center text-brand" title={t(place ? "beenThere" : "finished")}>
                <CheckIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">{t(place ? "beenThere" : "finished")}</span>
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t("kind", { kind: item.kind })}
            {item.year ? ` · ${item.year}` : ""}
          </span>
        </span>
        {/* For screen readers, which can't drag; shown when reached with the keyboard. */}
        <IconButton label={t("moveUp", { name: item.name })} disabled={first} onClick={() => onMove(-1)} className="sr-only focus-visible:not-sr-only">
          <ArrowUpIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={t("moveDown", { name: item.name })} disabled={last} onClick={() => onMove(1)} className="sr-only focus-visible:not-sr-only">
          <ArrowDownIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={t("remove", { name: item.name })} onClick={onRemove}>
          <XIcon className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
      {noting ? (
        <input
          value={item.note ?? ""}
          onChange={(e) => onNote(e.target.value.slice(0, RANK_NOTE_MAX))}
          aria-label={t("noteLabel", { name: item.name })}
          placeholder={t("notePlaceholder")}
          maxLength={RANK_NOTE_MAX}
          className="mr-1 ml-[4.5rem] h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      ) : (
        <button type="button" onClick={() => setNoting(true)} className="ml-[4.5rem] flex min-h-9 items-center self-start text-xs font-semibold text-muted-foreground hover:text-brand">
          {t("addNote")}
        </button>
      )}
    </li>
  );
}

/** The sheet that fills a place on the list: titles from every catalog, or places (countries and their regions). */
function PickSheet({ title, taken, onPick, onClose }: { title: string | null; taken: ReadonlySet<string>; onPick: (item: RankItem) => void; onClose: () => void }) {
  const t = useTranslations("Rank");
  const [tab, setTab] = useState<"titles" | "places">("titles");
  return (
    <Sheet open={title !== null} onClose={onClose} title={title ?? ""} closeLabel={t("close")}>
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label={title ?? ""} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["titles", "places"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className="min-h-10 rounded-full text-sm font-semibold text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm"
            >
              {t(value === "titles" ? "tabTitles" : "tabPlaces")}
            </button>
          ))}
        </div>
        {tab === "titles" ? <TitlePick taken={taken} onPick={onPick} /> : <PlacePicker taken={taken} onPick={onPick} />}
      </div>
    </Sheet>
  );
}

function TitlePick({ taken, onPick }: { taken: ReadonlySet<string>; onPick: (item: RankItem) => void }) {
  const t = useTranslations("Rank");
  const [query, setQuery] = useState("");
  const search = useTitleSearch(query, "all");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = query.trim().length >= MIN_SEARCH_CHARS && search.status === "done" ? search.results : [];

  function pick(result: SearchResult) {
    const ref = titleRef(result.kind, result.externalId);
    if (taken.has(ref)) return;
    onPick({
      ref,
      kind: result.kind,
      name: result.name,
      year: result.year ?? null,
      posterUrl: result.imageUrl && isCardPosterUrl(result.imageUrl) ? result.imageUrl : null,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        enterKeyHint="search"
        className="h-12 rounded-xl border border-input bg-card px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
      />
      <SearchStatus query={query} search={search} />
      <ul className="grid grid-cols-3 gap-3">
        {results.map((result) => {
          const ref = titleRef(result.kind, result.externalId);
          return (
            <li key={ref} className={cn(taken.has(ref) && "pointer-events-none opacity-40")}>
              <PosterButton result={result} onPick={pick} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
