"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { WarningTopic } from "@/core/catalog/dtdd";
import { AVOID_MAX } from "@/core/warnings";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

/** Saves this long after the last change, so ticking several boxes is one request. */
const SAVE_DELAY_MS = 600;

async function save(topicIds: number[], keepalive = false): Promise<boolean> {
  try {
    const res = await fetch("/api/warnings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicIds }),
      keepalive,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Settings → Content warnings: DTDD's topics grouped by category (collapsed), a search box, and the chosen ones as
 * removable stickers on top. Saved as you go.
 */
export function AvoidTopics({ topics, initial }: { topics: WarningTopic[]; initial: number[] }) {
  const t = useTranslations("Warnings");
  const inputId = useId();
  const [chosen, setChosen] = useState<number[]>(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const dirty = useRef(false);
  const latest = useRef(0);
  /** A change still waiting for its save. */
  const pending = useRef<number[] | null>(null);

  useEffect(() => {
    if (!dirty.current) return;
    const run = ++latest.current;
    pending.current = chosen;
    setStatus("saving");
    const timer = setTimeout(async () => {
      pending.current = null;
      const ok = await save(chosen);
      if (run === latest.current) setStatus(ok ? "saved" : "error");
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [chosen]);

  // Leaving the page (back to Settings) right after a tap still saves it.
  useEffect(
    () => () => {
      if (pending.current) void save(pending.current, true);
    },
    [],
  );

  function toggle(id: number) {
    dirty.current = true;
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= AVOID_MAX ? cur : [...cur, id]));
  }

  function clearAll() {
    dirty.current = true;
    setChosen([]);
  }

  const byId = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);
  const needle = query.trim().toLowerCase();
  const categories = useMemo(() => {
    const groups = new Map<string, WarningTopic[]>();
    for (const topic of topics) {
      if (needle && !topic.name.toLowerCase().includes(needle) && !topic.category.toLowerCase().includes(needle)) continue;
      groups.set(topic.category, [...(groups.get(topic.category) ?? []), topic]);
    }
    return [...groups.entries()];
  }, [topics, needle]);
  const picked = chosen.map((id) => byId.get(id)).filter((topic): topic is WarningTopic => !!topic);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {t("searchLabel")}
        </label>
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border border-input bg-card pr-4 pl-12 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby={`${inputId}-chosen`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${inputId}-chosen`} className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {t("chosen", { count: picked.length })}
          </h2>
          <p aria-live="polite" className={cn("text-xs", status === "error" ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {status === "saving" ? t("saving") : status === "saved" ? t("saved") : status === "error" ? t("saveError") : ""}
          </p>
        </div>
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {picked.map((topic, i) => (
              // Stickers stuck on at slightly different angles.
              <li key={topic.id} className={cn(i % 3 === 0 ? "-rotate-1" : i % 3 === 1 ? "rotate-1" : "rotate-0")}>
                <button
                  type="button"
                  onClick={() => toggle(topic.id)}
                  aria-label={t("remove", { topic: topic.name })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-soft py-1.5 pr-3 pl-4 text-sm font-semibold shadow-sm ring-1 ring-brand/20 hover:bg-brand/15"
                >
                  <span className="first-letter:uppercase">{topic.name}</span>
                  <XIcon aria-hidden className="size-4 text-brand" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={clearAll} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline">
                {t("clearAll")}
              </button>
            </li>
          </ul>
        )}
      </section>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMatch", { query: query.trim() })}</p>
      ) : (
        // A search opens every group it matched (the key remounts them, so taps afterwards still work).
        <div key={needle ? "search" : "browse"} className="flex flex-col gap-2">
          {categories.map(([category, list]) => {
            const count = list.filter((topic) => chosen.includes(topic.id)).length;
            return (
              <details key={category} open={needle ? true : undefined} className="group rounded-xl bg-card ring-1 ring-border">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold">
                  <span>{category}</span>
                  {count > 0 && <span className="text-xs font-bold text-brand">{t("categoryCount", { count })}</span>}
                </summary>
                <ul className="flex flex-col px-2 pb-2">
                  {list.map((topic) => (
                    <li key={topic.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={chosen.includes(topic.id)}
                          onChange={() => toggle(topic.id)}
                          className="size-5 shrink-0 accent-[var(--brand)]"
                        />
                        <span className="text-sm first-letter:uppercase">{topic.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
