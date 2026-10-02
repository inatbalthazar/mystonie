"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { forgetMyPhoto } from "@/cards/use-my-photo";
import { BIO_MAX, bioFits, DISPLAY_NAME_MAX, normalizeBio, normalizeUsername, USERNAME_RE } from "@/core/account";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { AvatarPicker } from "./avatar-picker";
import { saveAccount, type SaveResult } from "./save-account";

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; result: Extract<SaveResult, { ok: false }> | "format" | "bio" };

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";

/** Settings → Profile: the photo (uploaded on its own, ADR 0064), then display name, username and bio (ADR 0057), saved together. */
export function ProfileForm({
  username: savedUsername,
  displayName: savedName,
  bio: savedBio,
  avatarUrl,
}: {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Settings");
  const tp = useTranslations("Profile");
  const id = useId();
  const router = useRouter();
  const [username, setUsername] = useState(savedUsername);
  const [displayName, setDisplayName] = useState(savedName ?? "");
  const [bio, setBio] = useState(savedBio ?? "");
  const [photo, setPhoto] = useState(avatarUrl);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = normalizeUsername(username);
    if (!USERNAME_RE.test(name)) return setStatus({ kind: "error", result: "format" });
    const cleanBio = normalizeBio(bio);
    if (!bioFits(cleanBio)) return setStatus({ kind: "error", result: "bio" });
    setStatus({ kind: "saving" });
    const result = await saveAccount({ username: name, displayName, bio: cleanBio || null });
    if (!result.ok) return setStatus({ kind: "error", result });
    setUsername(name);
    setBio(cleanBio);
    setStatus({ kind: "saved" });
    router.refresh();
  }

  async function removePhoto() {
    setStatus({ kind: "saving" });
    const res = await fetch("/api/account/avatar", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setStatus({ kind: "error", result: { ok: false, error: "unavailable" } });
    setPhoto(null);
    forgetMyPhoto();
    setStatus({ kind: "idle" });
    router.refresh();
  }

  const error = status.kind === "error" ? status.result : null;
  const bioError = error === "bio";
  const usernameError = error === "format" || (error && error !== "bio" && error.field !== "display_name" && error.error !== "unavailable");
  const nameError = error !== null && error !== "format" && error !== "bio" && error.field === "display_name";
  const bioLength = [...bio].length;
  const message =
    error === null
      ? status.kind === "saved"
        ? t("saved")
        : ""
      : error === "bio"
        ? t("bioTooLong", { max: BIO_MAX })
        : error === "format" || error.error === "invalid"
        ? t("invalidUsername")
        : error.error === "username_taken"
          ? t("usernameTaken")
          : error.error === "name_not_allowed"
            ? t("nameNotAllowed", { field: error.field ?? "username" })
            : t("saveError");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 320 px photo from our storage (or a provider's, from before)
          <img src={photo} alt={t("photoAlt")} width={64} height={64} referrerPolicy="no-referrer" className="size-16 rounded-full object-cover ring-2 ring-card shadow" />
        ) : (
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-brand-soft font-display text-2xl font-extrabold text-brand uppercase">
            {(displayName || username).slice(0, 1)}
          </span>
        )}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Link href={`/u/${savedUsername}`} className="font-semibold text-brand underline-offset-4 hover:underline">
            {t("viewProfile")}
          </Link>
          <span className="truncate text-sm text-muted-foreground">{tp("handle", { username: savedUsername })}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <AvatarPicker
          hasPhoto={photo !== null}
          onSaved={(url) => {
            setPhoto(url);
            forgetMyPhoto();
            router.refresh();
          }}
        />
        {photo && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={status.kind === "saving"}
            className="h-11 self-start rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            {t("removePhoto")}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-name`} className="text-sm font-semibold">
          {t("displayName")}
        </label>
        <input
          id={`${id}-name`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          aria-invalid={nameError || undefined}
          aria-describedby={`${id}-name-hint ${id}-message`}
          className={inputClass}
        />
        <p id={`${id}-name-hint`} className="text-sm text-muted-foreground">
          {t("displayNameHint")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-username`} className="text-sm font-semibold">
          {t("username")}
        </label>
        <div className="flex items-center rounded-lg focus-within:outline-2 focus-within:outline-ring">
          <span aria-hidden="true" className="flex h-11 items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-muted-foreground">
            @
          </span>
          <input
            id={`${id}-username`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            aria-invalid={usernameError || undefined}
            aria-describedby={`${id}-username-hint ${id}-message`}
            className={cn(inputClass, "rounded-l-none focus-visible:outline-none")}
          />
        </div>
        <p id={`${id}-username-hint`} className="text-sm text-muted-foreground">
          {t("usernameHint")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-bio`} className="text-sm font-semibold">
            {t("bio")}
          </label>
          <span aria-hidden="true" className={cn("text-xs tabular-nums", bioLength > BIO_MAX ? "text-destructive" : "text-muted-foreground")}>
            {t("bioCount", { count: bioLength, max: BIO_MAX })}
          </span>
        </div>
        <textarea
          id={`${id}-bio`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder={t("bioPlaceholder")}
          aria-invalid={bioError || undefined}
          aria-describedby={`${id}-bio-hint ${id}-message`}
          className={cn(inputClass, "h-auto min-h-24 resize-y py-2 leading-snug")}
        />
        <p id={`${id}-bio-hint`} className="text-sm text-muted-foreground">
          {t("bioHint", { max: BIO_MAX })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="h-11 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
        >
          {status.kind === "saving" ? t("saving") : t("save")}
        </button>
        <p id={`${id}-message`} aria-live="polite" className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {message}
        </p>
      </div>
    </form>
  );
}
