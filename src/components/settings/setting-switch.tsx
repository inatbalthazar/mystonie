"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { saveAccount } from "./save-account";

// Each switch is one boolean-ish profile setting. Keys, not callbacks, so server pages can render them.
const SETTINGS = {
  emailRecaps: { label: "recapEmails", hint: "recapEmailsHint", patch: (on: boolean) => ({ emailRecaps: on }) },
  reelReminders: { label: "reelReminders", hint: "reelRemindersHint", patch: (on: boolean) => ({ reelReminders: on }) },
  // The Atlas on the album (stage 4, ADR 0059): off by default, since where you've lived says where you're from.
  atlasPublic: { label: "atlasPublic", hint: "atlasPublicHint", patch: (on: boolean) => ({ atlasPublic: on }) },
  publicProfile: {
    label: "publicProfile",
    hint: "publicProfileHint",
    patch: (on: boolean) => ({ visibility: on ? "public" : "private" }),
  },
} as const;

/** A settings switch, saved at once; it flips back if saving fails. */
export function SettingSwitch({ setting, initial }: { setting: keyof typeof SETTINGS; initial: boolean }) {
  const t = useTranslations("Settings");
  const id = useId();
  const { label, hint, patch } = SETTINGS[setting];
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    setFailed(false);
    const result = await saveAccount(patch(next));
    if (!result.ok) {
      setOn(!next);
      setFailed(true);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-label`} className="font-medium">
            {t(label)}
          </p>
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {t(hint)}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={toggle}
          disabled={saving}
          className="flex h-11 w-16 shrink-0 items-center justify-center disabled:opacity-60"
        >
          <span className={cn("flex h-7 w-12 items-center rounded-full p-1 transition-colors", on ? "bg-brand" : "bg-muted ring-1 ring-border")}>
            <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-5")} />
          </span>
        </button>
      </div>
      <p aria-live="polite" className={cn("text-sm text-destructive", !failed && "sr-only")}>
        {failed ? t("saveError") : ""}
      </p>
    </div>
  );
}
