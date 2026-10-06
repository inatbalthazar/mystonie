"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Official } from "@/core/official";
import { Link } from "@/i18n/navigation";
import { Avatar } from "./avatar";
import { OfficialLabel } from "./official-label";

/**
 * A person in a list: photo, name (with Stonie's or the team's label, ADR 0098) and handle (linking to their page), an
 * optional note, and an action on the right.
 */
export function PersonRow({
  person,
  note,
  action,
}: {
  person: { username: string; displayName: string | null; avatarUrl: string | null; official?: Official | null };
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
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold">{name}</span>
            <OfficialLabel official={person.official} />
          </span>
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
