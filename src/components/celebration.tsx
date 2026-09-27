"use client";

import { DownloadIcon, LinkIcon, PaletteIcon, Share2Icon, StickerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useCanShareFiles } from "@/cards/can-share";
import { CardPreview } from "@/cards/card-preview";
import { downloadBlob, usePrerenderedCard } from "@/cards/export";
import { RatingField, ReviewField } from "@/cards/fields";
import { useHeadline, useRecapRange } from "@/cards/parts";
import { DEFAULT_TEMPLATE, type TemplateId } from "@/cards/registry";
import { usePosterPalette } from "@/cards/use-poster-palette";
import { cardShareUrl, clampReview, cycle, finalReview } from "@/core/cards/edit";
import { templatesFor } from "@/core/cards/templates";
import type { CardData, CardHideable, CardSize } from "@/core/cards/types";
import type { EntryNotes } from "@/core/collection/entries";
import { uuidv7 } from "@/core/ids";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * What the card is about: a finished entry, a logged episode, a week (recap) or a stats period (Share stats).
 * `ready` = saved on the server.
 */
export type CelebrationSource =
  | { kind: "finish"; entryId: string; ready: boolean }
  | { kind: "progress"; episodeLogId: string | null; ready: boolean }
  | { kind: "weekly_recap"; recapId: string; ready: boolean }
  | { kind: "stats"; ready: boolean };

const FIRST_TEMPLATE: Record<CelebrationSource["kind"], TemplateId> = {
  finish: DEFAULT_TEMPLATE,
  progress: "boldStats",
  weekly_recap: "collage",
  stats: "boldStats",
};

type Props = {
  data: CardData;
  source: CelebrationSource;
  /** Stamp animation + haptic: right after a finish. Off for "Make a card" on an older finish. */
  animate?: boolean;
  username: string | null;
  host: string;
  /** Closes the celebration. `notes` is set when the rating or review changed (finish cards). */
  onClose: (notes: EntryNotes | null) => void;
};

const SWIPE_PX = 40;

/**
 * The celebration (S1 share artwork → Celebration flow): a full-screen moment with the FINISHED stamp, the
 * card with **Share** first, then Download / Change style / Sticker, and the optional rating and review.
 * Skip is always visible. Share publishes the card at `/c/[id]` (inputs + PNG) while the share sheet opens.
 * Mount it only while open (a new card id each time).
 */
export function Celebration({ data, source, animate = false, username, host, onClose }: Props) {
  const t = useTranslations("Celebration");
  const tc = useTranslations("Card");
  const dialog = useRef<HTMLDialogElement>(null);
  const [cardId] = useState(uuidv7);
  const styles = templatesFor(source.kind);
  const [template, setTemplate] = useState<TemplateId>(FIRST_TEMPLATE[source.kind]);
  const range = useRecapRange(data.recap);
  const headline = useHeadline(data);
  const [sticker, setSticker] = useState(false);
  const [size, setSize] = useState<CardSize>("story");
  const [rating, setRating] = useState<number | null>(data.rating ?? null);
  const [review, setReview] = useState(() => clampReview(data.review ?? ""));
  const [hide, setHide] = useState<CardHideable[]>([]);
  const [delivered, setDelivered] = useState(false);
  const [notice, setNotice] = useState("");
  const canShare = useCanShareFiles();

  const templateId: TemplateId = sticker ? "sticker" : template;
  const kind = sticker ? "sticker" : source.kind;
  const card: CardData = {
    ...data,
    rating: source.kind === "finish" ? rating : null,
    review: source.kind === "finish" ? finalReview(review) : null,
    username: hide.includes("username") ? null : username,
    hide,
  };
  const palette = usePosterPalette(data.posterUrl);
  const cardRef = useRef<HTMLDivElement>(null);
  const png = usePrerenderedCard(cardRef, size, JSON.stringify([templateId, size, card, palette]));
  const ready = !!png && source.ready;

  useEffect(() => {
    dialog.current?.showModal();
    track("card_created", { kind: data.kind, tpl: templateId, card: source.kind });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !still) navigator.vibrate?.([14, 60, 24]);
    // Once per celebration: the first card is what was created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    const changed = source.kind === "finish" && (rating !== (data.rating ?? null) || finalReview(review) !== (data.review ?? null));
    onClose(changed ? { rating, review: finalReview(review) } : null);
  }

  function changeStyle(step: 1 | -1 = 1) {
    setSticker(false);
    const next = cycle(styles, template, step);
    setTemplate(next);
    track("template_switched", { tpl: next, via: "button" });
  }

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerUp(e: PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || sticker) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      const next = cycle(styles, template, dx < 0 ? 1 : -1);
      setTemplate(next);
      track("template_switched", { tpl: next, via: "swipe" });
    }
  }

  /** Saves the card's inputs; with `blob`, publishes it and uploads the PNG. */
  async function save(blob: Blob | null) {
    // The server prints the username from the profile; the browser never sends one.
    const inputs = { ...card, username: undefined };
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cardId,
        kind,
        templateId,
        size,
        entryId: source.kind === "finish" ? source.entryId : null,
        episodeLogId: source.kind === "progress" ? source.episodeLogId : null,
        recapId: source.kind === "weekly_recap" ? source.recapId : null,
        data: inputs,
        share: !!blob,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { uploadUrl } = (await res.json()) as { uploadUrl: string | null };
    if (blob && uploadUrl) {
      const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png", "x-upsert": "true" }, body: blob });
      if (!upload.ok) throw new Error(`upload ${upload.status}`);
    }
  }

  const filename = () => {
    if (data.recap) return `mystonie-${data.recap.period ?? "week"}-${data.recap.from}-${templateId}.png`;
    const slug = data.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "card";
    return `mystonie-${slug}-${templateId}.png`;
  };

  function download(fallback = false) {
    if (!png) return;
    downloadBlob(png, filename());
    setDelivered(true);
    track("card_downloaded", { tpl: templateId, size, fallback, card: kind });
    if (source.ready) save(null).catch((error) => console.error(error));
  }

  // Must stay synchronous up to navigator.share(): iOS Safari rejects a share that awaits anything first.
  // Publishing runs alongside; the link works once it lands (well before anyone taps it).
  function share() {
    if (!png || !ready) return;
    const link = cardShareUrl(`${window.location.origin}/c/${cardId}`, templateId);
    const published = save(png).catch((error) => {
      console.error(error);
      setNotice(t("publishError"));
      throw error;
    });
    if (!canShare) {
      published.then(
        () => navigator.clipboard?.writeText(link).then(() => setNotice(t("linkCopied")), () => setNotice(link)),
        () => {},
      );
      setDelivered(true);
      track("card_shared", { tpl: templateId, size, channel: "link", card: kind });
      return;
    }
    const files = [new File([png], filename(), { type: "image/png" })];
    const withUrl = { files, url: link };
    const payload = navigator.canShare(withUrl) ? withUrl : { files };
    navigator.share(payload).then(
      () => {
        setDelivered(true);
        track("card_shared", { tpl: templateId, size, channel: "share_sheet", card: kind });
      },
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) download(true);
      },
    );
  }

  function toggleHide(item: CardHideable) {
    setHide((cur) => (cur.includes(item) ? cur.filter((h) => h !== item) : [...cur, item]));
  }
  const hideable: CardHideable[] = [
    ...(username ? (["username"] as const) : []),
    "time",
    ...((data.recap ? data.recap.episodes > 0 : data.kind === "series") ? (["episodes"] as const) : []),
  ];

  return (
    <dialog
      ref={dialog}
      aria-labelledby="celebration-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 py-2 backdrop-blur">
          <p className="text-sm font-semibold text-muted-foreground">{t("yourCard")}</p>
          <button type="button" onClick={close} className="h-11 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted">
            {delivered ? t("done") : t("skip")}
          </button>
        </div>

        <header className="mt-3 flex flex-col items-center gap-3 text-center">
          <p
            aria-hidden="true"
            className={cn(
              // Letter spacing splits Thai vowel and tone marks from their consonants: Latin only.
              "rotate-[-8deg] rounded-xl border-4 border-brand px-4 py-1 font-display text-2xl font-extrabold tracking-[0.12em] text-brand uppercase [&:lang(th)]:tracking-normal",
              animate && "motion-safe:animate-stamp",
            )}
          >
            {headline}
          </p>
          <h2 id="celebration-title" className="mt-1 font-hand text-2xl leading-tight text-balance">
            {source.kind === "finish"
              ? t("finishedTitle", { name: data.name })
              : data.recap
                ? t("recapTitle", { period: data.recap.period ?? "week", range })
                : data.progress?.milestone
                  ? t("milestoneTitle", { name: data.name, milestone: data.progress.milestone })
                  : t("progressTitle", { name: data.name })}
          </h2>
        </header>

        <div
          className={cn("mx-auto w-full max-w-[14rem] touch-pan-y select-none", animate && "motion-safe:animate-rise")}
          onPointerDown={(e) => (swipeStart.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeStart.current = null)}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className={cn("rounded-xl", sticker && "bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px] ring-1 ring-border")}>
            <CardPreview template={templateId} data={card} size={size} palette={palette} host={host} cardRef={cardRef} />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
            {sticker ? t("stickerHint") : t("styleLabel", { style: tc(`templates.${template}`) })}
          </p>
        </div>

        <button
          type="button"
          onClick={share}
          disabled={!ready}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-lg font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60"
        >
          {canShare ? <Share2Icon className="size-5" aria-hidden="true" /> : <LinkIcon className="size-5" aria-hidden="true" />}
          {!ready ? t("preparing") : canShare ? t("share") : t("shareLink")}
        </button>
        <div className="grid grid-cols-3 gap-2">
          <SecondaryAction onClick={() => download()} disabled={!png} icon={<DownloadIcon className="size-5" aria-hidden="true" />}>
            {t("download")}
          </SecondaryAction>
          <SecondaryAction onClick={() => changeStyle()} disabled={styles.length < 2} icon={<PaletteIcon className="size-5" aria-hidden="true" />}>
            {t("changeStyle")}
          </SecondaryAction>
          <SecondaryAction onClick={() => setSticker((s) => !s)} pressed={sticker} icon={<StickerIcon className="size-5" aria-hidden="true" />}>
            {t("sticker")}
          </SecondaryAction>
        </div>
        <p role="status" className="min-h-5 text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {notice}
        </p>

        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div role="group" aria-label={tc("size")} className="flex gap-1 rounded-full bg-muted p-1">
            {(["story", "feed"] as const).map((s) => (
              <Chip key={s} pressed={size === s} onClick={() => setSize(s)} className="flex-1">
                {tc(`sizes.${s}`)}
              </Chip>
            ))}
          </div>
          <div role="group" aria-label={t("hideOnCard")} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t("hideOnCard")}</span>
            {hideable.map((item) => (
              <Chip key={item} pressed={hide.includes(item)} onClick={() => toggleHide(item)} className="ring-1 ring-border">
                {t("hideItem", { item, username: username ?? "" })}
              </Chip>
            ))}
          </div>
        </div>

        {source.kind === "finish" && (
          <section aria-labelledby="celebration-notes" className="flex flex-col gap-3">
            <h3 id="celebration-notes" className="font-display text-lg font-extrabold">
              {t("notesTitle")}
            </h3>
            <RatingField rating={rating} onChange={setRating} />
            <ReviewField review={review} onChange={setReview} />
          </section>
        )}
      </div>
    </dialog>
  );
}

function SecondaryAction({
  onClick,
  disabled,
  pressed,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50 aria-pressed:bg-brand-soft aria-pressed:ring-brand/50"
    >
      {icon}
      {children}
    </button>
  );
}

function Chip({ pressed, onClick, className, children }: { pressed: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full px-3 text-sm font-medium transition-colors",
        pressed ? "bg-card text-foreground shadow-sm ring-1 ring-brand/60" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
