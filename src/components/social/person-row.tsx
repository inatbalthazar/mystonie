"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Avatar } from "./avatar";

/** A person in a list: photo, name and handle (linking to their page), an optional note, and an action on the right. */
export function PersonRow({
  person,
  note,
  action,
}: {
  person: { username: string; displayName: string | null; avatarUrl: string | null };
  note?: ReactNode;
  action?: ReactNode;
}) {
  const t = useTranslations("Social");
  const name = person.displayName || person.username;
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:opacity-90">
        <Avatar name={name} url={person.avatarUrl} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t("handle", { username: person.username })}
            {note}
          </span>
        </span>
      </Link>
      {action}
    </div>
  );
}
