"use client";

import { CameraIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AVATAR_SIZE, centredFraming, clampFraming, cropSquare, MAX_ZOOM, zoomFraming, type Framing } from "@/core/avatar";
import { Sheet } from "../sheet";

/** The crop frame's width on screen, in px (fits a 360 px phone with the sheet's padding). */
const VIEW = 256;

type Picture = { bitmap: ImageBitmap; url: string; width: number; height: number };

/** Opens a picked file as a bitmap the right way up (EXIF rotation applied), or null when the browser can't read it. */
async function openPicture(file: File): Promise<Picture | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bitmap, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
}

/** The framed square as a `AVATAR_SIZE` px WebP (JPEG where the browser can't make WebP). */
async function render(picture: Picture, framing: Framing): Promise<Blob | null> {
  const crop = cropSquare(picture.width, picture.height, VIEW, framing);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(picture.bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  const blob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await blob("image/webp", 0.85);
  return webp?.type === "image/webp" ? webp : blob("image/jpeg", 0.88);
}

/**
 * Settings → Profile's photo (ADR 0064): "Add photo" / "Change photo" picks a picture from the phone, a sheet frames it
 * (drag to move, slide to zoom; a round mask shows what the profile will show), and the browser cuts a 320 px square
 * and uploads it to POST /api/account/avatar. `onSaved` gets the new photo's URL.
 */
export function AvatarPicker({ hasPhoto, onSaved }: { hasPhoto: boolean; onSaved: (url: string) => void }) {
  const t = useTranslations("Settings");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; from: Framing } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [framing, setFraming] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  const [status, setStatus] = useState<"idle" | "saving" | "unreadable" | "error">("idle");

  // The previous picture's memory goes when another is picked or the sheet closes.
  useEffect(
    () => () => {
      if (!picture) return;
      picture.bitmap.close();
      URL.revokeObjectURL(picture.url);
    },
    [picture],
  );

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    const opened = await openPicture(file);
    if (!opened) return setStatus("unreadable");
    setStatus("idle");
    setFraming(centredFraming(opened.width, opened.height, VIEW));
    setPicture(opened);
  }

  async function save() {
    if (!picture) return;
    setStatus("saving");
    try {
      const blob = await render(picture, framing);
      if (!blob) throw new Error("no image");
      const res = await fetch("/api/account/avatar", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error(String(res.status));
      const { avatarUrl } = (await res.json()) as { avatarUrl: string };
      setPicture(null);
      setStatus("idle");
      onSaved(avatarUrl);
    } catch {
      setStatus("error");
    }
  }

  const move = (dx: number, dy: number, from: Framing) =>
    picture && setFraming(clampFraming(picture.width, picture.height, VIEW, { ...from, x: from.x + dx, y: from.y + dy }));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: framing };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) move(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current.from);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const by = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!by) return;
    e.preventDefault();
    move(by[0]!, by[1]!, framing);
  }

  const scale = picture ? (VIEW / Math.min(picture.width, picture.height)) * framing.zoom : 1;

  return (
    <>
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="inline-flex h-11 items-center gap-2 self-start rounded-full px-4 text-sm font-semibold ring-1 ring-border hover:bg-muted press"
      >
        <CameraIcon className="size-4" aria-hidden="true" />
        {hasPhoto ? t("changePhoto") : t("addPhoto")}
      </button>
      {status === "unreadable" && (
        <p role="alert" className="text-sm text-destructive">
          {t("photoUnreadable")}
        </p>
      )}

      <Sheet open={picture !== null} onClose={() => status !== "saving" && setPicture(null)} title={t("photoTitle")} closeLabel={t("photoCancel")}>
        {picture && (
          <div className="flex flex-col items-center gap-4 pb-2">
            <div
              role="img"
              aria-label={t("photoFrame")}
              aria-describedby={`${id}-how`}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
              style={{ width: VIEW, height: VIEW }}
              className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-muted select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:cursor-grabbing"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file */}
              <img
                src={picture.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ left: framing.x, top: framing.y, width: picture.width * scale, height: picture.height * scale }}
              />
              {/* What the profile shows: the circle; the corners outside it are dimmed. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200px_rgb(0_0_0/0.45)] ring-2 ring-white/80"
              />
            </div>
            <p id={`${id}-how`} className="text-center text-sm text-muted-foreground">
              {t("photoHow")}
            </p>
            <label className="flex w-full max-w-64 items-center gap-3 text-sm font-semibold">
              {t("photoZoom")}
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={framing.zoom}
                onChange={(e) => setFraming(zoomFraming(picture.width, picture.height, VIEW, framing, Number(e.target.value)))}
                className="h-11 flex-1 accent-brand"
              />
            </label>
            {status === "error" && (
              <p role="alert" className="text-center text-sm text-destructive">
                {t("photoError")}
              </p>
            )}
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={save}
                disabled={status === "saving"}
                className="h-12 w-full rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
              >
                {status === "saving" ? t("saving") : t("photoUse")}
              </button>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={status === "saving"}
                className="h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                {t("photoAnother")}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
