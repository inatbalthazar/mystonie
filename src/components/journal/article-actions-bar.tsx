"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StampButton } from "@/components/social/stamp-button";
import { SaveButton, ShareButton } from "./article-actions";

type Marks = { stamps: number; stamped: boolean; saved: boolean; signedIn: boolean };

const noSubscribe = () => () => {};
/** The signed-in hint the pre-paint script sets (src/core/auth.ts), until the server says. */
const hinted = () => document.documentElement.dataset.auth !== undefined;

/**
 * Stamp, Save and Share under a Journal article (ADR 0052). The page is static, so the Stamp count and the reader's
 * own Stamp and Save load once it's open (GET /api/journal/marks). Visitors get links to sign in and come back
 * (`next`); anyone can share.
 */
export function ArticleActionsBar({ slug, title, next }: { slug: string; title: string; next: string }) {
  const t = useTranslations("Journal");
  const signedInHint = useSyncExternalStore(noSubscribe, hinted, () => false);
  const [marks, setMarks] = useState<Marks | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/journal/marks?${new URLSearchParams({ slug })}`)
      .then((res) => (res.ok ? (res.json() as Promise<Marks>) : null))
      .then((loaded) => {
        if (live && loaded) setMarks(loaded);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  const signedIn = marks ? marks.signedIn : signedInHint;
  // The buttons keep their own state once tapped; they start again from what the server said once it says.
  const key = marks ? "loaded" : "loading";
  return (
    <section aria-label={t("actionsLabel")} className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border p-4">
      <p className="font-hand text-2xl leading-none text-muted-foreground">{t("enjoyed")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StampButton
          key={`stamp-${key}`}
          article={{ slug, place: "article" }}
          stamped={marks?.stamped ?? false}
          count={marks?.stamps ?? 0}
          mine={false}
          signInNext={signedIn ? undefined : next}
        />
        <SaveButton key={`save-${key}`} slug={slug} saved={marks?.saved ?? false} place="article" signInNext={signedIn ? undefined : next} />
        <ShareButton slug={slug} title={title} place="article" />
      </div>
    </section>
  );
}
