import { getFormatter, getTranslations } from "next-intl/server";
import { SHARE_MIN_MEMBERS } from "@/core/finish-share";
import { titleFinishers } from "@/data/finishers";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { formatShare } from "@/lib/share";
import { cn } from "@/lib/utils";
import { PaperCard } from "../paper-card";
import { Avatar } from "../social/avatar";

/** The finishers seal as the page draws it: brand ink, double ring; dashed and empty while it's still to earn. */
function Seal({ value, empty = false, className }: { value: string; empty?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-4 p-1",
        empty ? "border-dashed border-border text-muted-foreground" : "-rotate-6 border-brand bg-card text-brand shadow-sm",
        className,
      )}
    >
      <span className={cn("flex size-full items-center justify-center rounded-full border-2 border-current", !empty && "border-dashed")}>
        <span className="font-display leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap">{value}</span>
      </span>
    </span>
  );
}

/**
 * Finishers on a title page (S3 finishers & the board, ADR 0067): whether you finished it, how many people did and,
 * once Mystonie has 1,000 members, what share of everyone that is; then the people you follow who did, newest first.
 * No finisher numbers: a finish isn't a race. Rendered inside Suspense.
 */
export async function TitleFinishers({ supabase, userId, titleId }: { supabase: UserClient; userId: string; titleId: string }) {
  const [data, t, format] = await Promise.all([
    titleFinishers(supabase, userId, titleId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    getTranslations("Finishers"),
    getFormatter(),
  ]);
  if (!data) return null;
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const value = data.share ? formatShare(format, data.share) : format.number(data.count);
  const big = value.length <= 3 ? "text-2xl" : value.length <= 4 ? "text-lg" : "text-base";

  return (
    <PaperCard className="flex flex-col gap-4 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <div className="flex items-center gap-4">
        <Seal value={value} empty={!data.mine} className={cn("size-20", big)} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-hand text-2xl leading-tight">{data.mine ? t("mine") : t("next", { first: data.count === 0 ? "true" : "false" })}</p>
          {data.count > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("count", { count: data.count })}
              {data.share ? ` ${t("share", { share: formatShare(format, data.share) })}` : ""}
            </p>
          )}
        </div>
      </div>

      {data.friends.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t("friends")}</h3>
          <ul className="flex flex-col">
            {data.friends.map((f) => {
              const name = f.displayName || f.username;
              return (
                <li key={f.id} className="flex items-center gap-3 border-b border-dashed border-border py-2 last:border-b-0">
                  <Link href={`/u/${f.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:opacity-90">
                    <Avatar name={name} url={f.avatarUrl} className="size-8" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground">{t("friendWhen", { when: format.relativeTime(new Date(f.finishedAt), now) })}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!data.share && <p className="text-xs text-muted-foreground">{t("hint", { members: format.number(SHARE_MIN_MEMBERS) })}</p>}
    </PaperCard>
  );
}
