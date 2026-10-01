"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { searchCountries } from "@/core/atlas";
import type { CountryCode } from "@/core/countries";
import { cn } from "@/lib/utils";

/**
 * Find a country by name, in the viewer's language or English (a combobox): the Atlas's way to a country without the
 * map, for small countries and for keyboards and screen readers. Picking one opens its sheet.
 */
export function CountrySearch({
  options,
  onPick,
}: {
  options: readonly (readonly [CountryCode, string, string])[];
  onPick: (code: CountryCode) => void;
}) {
  const t = useTranslations("Atlas");
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const names = useMemo(() => new Map(options.map(([code, name]) => [code, name])), [options]);
  const results = searchCountries(query, options);
  const open = results.length > 0;

  function pick(code: CountryCode) {
    onPick(code);
    setQuery("");
    setActive(0);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => (a + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[Math.min(active, results.length - 1)]!);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="sr-only">
        {t("searchLabel")}
      </label>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${id}-${results[Math.min(active, results.length - 1)]}` : undefined}
        autoComplete="off"
        enterKeyHint="done"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={keyDown}
        placeholder={t("searchPlaceholder")}
        className="h-12 w-full rounded-full bg-card pr-4 pl-11 text-base ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
      />
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label={t("searchLabel")}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-popover shadow-lg ring-1 ring-border"
      >
        {results.map((code, i) => (
          <li
            key={code}
            id={`${id}-${code}`}
            role="option"
            aria-selected={i === active}
            // Keeps focus in the input, so the tap picks before the list closes.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(code)}
            className={cn("flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium", i === active && "bg-muted")}
          >
            {names.get(code) ?? code}
          </li>
        ))}
      </ul>
      {query.trim() !== "" && !open && <p className="mt-2 px-1 text-sm text-muted-foreground">{t("searchNone")}</p>}
    </div>
  );
}
