import { UsersIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import type { FeedItem } from "@/core/social";
import { Link } from "@/i18n/navigation";
import { StampButton } from "./stamp-button";

/**
 * Home's "From people you follow" (S3 social): the latest few finishes of the people you follow, with a Stamp each
 * and a way into the full feed. Nobody to show yet → an invitation to find people.
 */
export function FriendsFinished({ items, now }: { items: FeedItem[]; now: number }) {
  const t = useTranslations("Social");
  const format = useFormatter();

  return (
    <section aria-labelledby="friends-finished" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="friends-finished" className="font-display text-xl font-extrabold">
          {t("homeTitle")}
        </h2>
        <Link href={items.length ? "/feed" : "/people"} className="flex min-h-11 items-center text-sm font-semibold text-brand">
          {items.length ? t("seeFeed") : t("findPeople")}
        </Link>
      </div>
      {items.length === 0 ? (
        <Link
          href="/people"
          className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-border px-4 py-4 hover:border-brand/50"
        >
          <span aria-hidden="true" className="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-xl bg-brand-soft text-brand">
            <UsersIcon className="size-6" />
          </span>
          <span className="flex flex-col">
            <span className="font-hand text-xl leading-tight">{t("homeEmpty")}</span>
            <span className="text-sm text-muted-foreground">{t("homeEmptyHint")}</span>
          </span>
        </Link>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li
              key={item.entryId}
              className={`flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border ${i % 2 ? "rotate-[0.4deg]" : "rotate-[-0.4deg]"}`}
            >
              <Link
                href={`/title/${item.title.kind}/${item.title.externalId}`}
                aria-hidden="true"
                tabIndex={-1}
                className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-sm bg-muted ring-1 ring-border"
              >
                {item.title.posterUrl && <Image src={item.title.posterUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />}
              </Link>
              <p className="min-w-0 flex-1 text-sm">
                <Link href={`/u/${item.user.username}`} className="hover:underline">
                  {t.rich("friendFinished", {
                    name: item.user.displayName || item.user.username,
                    title: item.title.name,
                    b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                  })}
                </Link>
                <span className="block text-xs text-muted-foreground">{format.relativeTime(new Date(item.finishedAt), now)}</span>
              </p>
              <StampButton entryId={item.entryId} stamped={item.stamped} count={item.stampCount} mine={false} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
