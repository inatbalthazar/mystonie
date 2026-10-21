"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TIER_COLOURS } from "@/cards/rank-parts";
import { ROW_NAMES, TIER_ITEMS_MAX, TIER_LABEL_MAX, TIERS_MAX, type RankItem } from "@/core/rankings";
import { cn } from "@/lib/utils";
import { IconButton, Thumb } from "./rank-bits";

/** A row's label as shown: what the owner typed, or the row's default letter while it's blank. */
export const rowName = (tiers: readonly string[], row: number) => tiers[row]?.trim() || ROW_NAMES[row] || String(row + 1);

/**
 * The tier list being made (ADR 0099, step 2): a row per tier with its colour and a label to rename, its things as small
 * posters and a ＋ to add more. Tap a poster for its tools: another row, left or right in its row, or off the list.
 */
export function TierEditor({
  tiers,
  items,
  done,
  selected,
  onSelect,
  onLabel,
  onAddRow,
  onRemoveRow,
  onPick,
  onMoveTo,
  onShift,
  onRemove,
}: {
  tiers: readonly string[];
  items: readonly RankItem[];
  done: ReadonlySet<string>;
  selected: string | null;
  onSelect: (ref: string | null) => void;
  onLabel: (row: number, label: string) => void;
  onAddRow: () => void;
  onRemoveRow: (row: number) => void;
  onPick: (row: number) => void;
  onMoveTo: (ref: string, row: number) => void;
  onShift: (ref: string, by: 1 | -1) => void;
  onRemove: (ref: string) => void;
}) {
  const t = useTranslations("Rank");
  const full = items.length >= TIER_ITEMS_MAX;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {tiers.map((label, row) => {
          const inRow = items.filter((i) => i.tier === row);
          const chosen = inRow.find((i) => i.ref === selected);
          const name = rowName(tiers, row);
          return (
            <li key={row} className="flex flex-col gap-2 rounded-2xl bg-card p-1.5 shadow-sm ring-1 ring-border">
              <div className="flex items-stretch gap-2">
                <label className="flex w-16 shrink-0 items-center rounded-xl px-1 shadow-sm" style={{ background: TIER_COLOURS[row % TIER_COLOURS.length] }}>
                  <span className="sr-only">{t("rowLabel", { row: row + 1 })}</span>
                  {/* Two lines, so "Must watch" fits a phone's narrow label; Enter doesn't add a third. */}
                  <textarea
                    value={label}
                    onChange={(e) => onLabel(row, e.target.value.replace(/\s*\n\s*/g, " ").slice(0, TIER_LABEL_MAX))}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder={ROW_NAMES[row]}
                    maxLength={TIER_LABEL_MAX}
                    rows={2}
                    className={cn(
                      "field-sizing-fixed w-full min-w-0 resize-none overflow-hidden bg-transparent text-center font-display font-extrabold text-[#1d1a16] outline-none placeholder:text-[#1d1a16]/40",
                      label.length <= 2 ? "h-8 text-2xl leading-8" : "h-8 text-xs leading-4",
                    )}
                  />
                </label>
                <div className="flex min-h-[4.25rem] min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5">
                  {inRow.map((item) => (
                    <button
                      key={item.ref}
                      type="button"
                      aria-pressed={selected === item.ref}
                      aria-label={item.name}
                      onClick={() => onSelect(selected === item.ref ? null : item.ref)}
                      className="relative rounded-md outline-offset-2 aria-pressed:outline-[3px] aria-pressed:outline-brand"
                    >
                      <Thumb item={item} />
                      {done.has(item.ref) && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card">
                          <CheckIcon className="size-3" strokeWidth={3.5} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onPick(row)}
                    disabled={full}
                    aria-label={t("rowAdd", { tier: name })}
                    className="flex aspect-[2/3] w-11 items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-40"
                  >
                    <PlusIcon className="size-5" aria-hidden="true" />
                  </button>
                  {inRow.length === 0 && <span className="text-xs text-muted-foreground">{t("rowEmpty")}</span>}
                </div>
                {tiers.length > 1 && inRow.length === 0 && (
                  <IconButton label={t("removeRow", { tier: name })} onClick={() => onRemoveRow(row)}>
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </IconButton>
                )}
              </div>

              {chosen && (
                <ItemTools
                  item={chosen}
                  tiers={tiers}
                  first={inRow[0]?.ref === chosen.ref}
                  last={inRow.at(-1)?.ref === chosen.ref}
                  onMoveTo={(to) => onMoveTo(chosen.ref, to)}
                  onShift={(by) => onShift(chosen.ref, by)}
                  onRemove={() => onRemove(chosen.ref)}
                  onDone={() => onSelect(null)}
                />
              )}
            </li>
          );
        })}
      </ol>

      {tiers.length < TIERS_MAX && (
        <button type="button" onClick={onAddRow} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand">
          <PlusIcon className="size-4" aria-hidden="true" />
          {t("addRow")}
        </button>
      )}
      <p className="text-sm text-muted-foreground">
        {full ? t("tierFull", { max: TIER_ITEMS_MAX }) : t("tierCount", { count: items.length, max: TIER_ITEMS_MAX })}
        {" · "}
        {t("tierHint")}
      </p>
    </div>
  );
}

/** A chosen poster's tools: the rows to move it to, left and right within its row, off the list. */
function ItemTools({
  item,
  tiers,
  first,
  last,
  onMoveTo,
  onShift,
  onRemove,
  onDone,
}: {
  item: RankItem;
  tiers: readonly string[];
  first: boolean;
  last: boolean;
  onMoveTo: (row: number) => void;
  onShift: (by: 1 | -1) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("Rank");
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-2">
      <p className="truncate text-sm font-semibold">{item.name}</p>
      <div role="group" aria-label={t("moveTo")} className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">{t("moveTo")}</span>
        {tiers.map((_, row) => (
          <button
            key={row}
            type="button"
            aria-pressed={item.tier === row}
            onClick={() => onMoveTo(row)}
            className="min-h-9 min-w-9 rounded-lg px-2 font-display text-sm font-extrabold text-[#1d1a16] shadow-sm aria-pressed:ring-2 aria-pressed:ring-foreground"
            style={{ background: TIER_COLOURS[row % TIER_COLOURS.length] }}
          >
            {rowName(tiers, row)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <IconButton label={t("moveLeft", { name: item.name })} disabled={first} onClick={() => onShift(-1)}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={t("moveRight", { name: item.name })} disabled={last} onClick={() => onShift(1)}>
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={t("remove", { name: item.name })} onClick={onRemove}>
          <XIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <button type="button" onClick={onDone} className="ml-auto min-h-10 rounded-full px-4 text-sm font-semibold text-brand hover:bg-card">
          {t("deselect")}
        </button>
      </div>
    </div>
  );
}
