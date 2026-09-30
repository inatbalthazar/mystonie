"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { normalizePeopleQuery, PEOPLE_QUERY_MAX, type Person } from "@/core/social";
import { FollowButton } from "./follow-button";
import { PersonRow } from "./person-row";

type State = { status: "idle" } | { status: "loading" } | { status: "done"; people: Person[] } | { status: "error" | "limited" };

/** Find people by username or name (GET /api/people, debounced). Private and blocked profiles never show up. */
export function PeopleSearch() {
  const t = useTranslations("Social");
  const id = useId();
  const [raw, setRaw] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const query = normalizePeopleQuery(raw);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/people?${new URLSearchParams({ q: query })}`, { signal: controller.signal });
        if (res.status === 429) return setState({ status: "limited" });
        if (!res.ok) throw new Error(String(res.status));
        const { people } = (await res.json()) as { people: Person[] };
        setState({ status: "done", people });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const shown = query ? state : ({ status: "idle" } as const);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-q`} className="sr-only">
        {t("searchLabel")}
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={`${id}-q`}
          type="search"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          maxLength={PEOPLE_QUERY_MAX + 5}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-input bg-card pr-4 pl-11 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
      </div>
      <div aria-live="polite" className="flex flex-col">
        {shown.status === "loading" && <p className="py-2 text-sm text-muted-foreground">{t("searching")}</p>}
        {shown.status === "error" && <p className="py-2 text-sm text-destructive">{t("problem", { problem: "error" })}</p>}
        {shown.status === "limited" && <p className="py-2 text-sm text-destructive">{t("problem", { problem: "limited" })}</p>}
        {shown.status === "done" && shown.people.length === 0 && (
          <p className="py-2 font-hand text-xl text-muted-foreground">{t("noPeople", { query: raw.trim() })}</p>
        )}
        {shown.status === "done" && shown.people.length > 0 && (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {shown.people.map((p) => (
              <li key={p.id}>
                <PersonRow
                  person={p}
                  note={t("finishedNote", { count: p.finished })}
                  action={<FollowButton userId={p.id} following={p.iFollow} via="search" />}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
