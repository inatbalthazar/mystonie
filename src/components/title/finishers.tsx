import { getFormatter, getTranslations } from "next-intl/server";
import { titleFinishers } from "@/data/finishers";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PaperCard } from "../paper-card";
import { Avatar } from "../social/avatar";

/** The finisher seal as the page draws it: brand ink, double ring; dashed and empty while it's still to earn. */
function Seal({ number, empty = false, className }: { number: string; empty?: boolean; className?: string }) {
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
        <span className="font-display leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap">{number}</span>
      </span>
    </span>
  );
}

/**
 * Finisher #N on a title page (S3 finishers & the board): your number (or the one you'd get), how many people finished
 * it on Mystonie, and the people you follow who did, in finishing order. Rendered inside Suspense.
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
  const number = (n: number) => t("number", { number: format.number(n) });
  const big = (n: number) => (String(n).length <= 3 ? "text-2xl" : String(n).length <= 5 ? "text-lg" : "text-sm");

  return (
    <PaperCard className="flex flex-col gap-4 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <div className="flex items-center gap-4">
        {data.mine ? (
          <Seal number={number(data.mine)} className={cn("size-20", big(data.mine))} />
        ) : (
          <Seal number={number(data.count + 1)} empty className={cn("size-20", big(data.count + 1))} />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          {data.mine ? (
            <p className="font-hand text-2xl leading-tight">
              {t("mine")} {number(data.mine)}
            </p>
          ) : (
            <p className="font-hand text-2xl leading-tight">
              {t("next", { first: data.count === 0 ? "true" : "false", number: format.number(data.count + 1) })}
            </p>
          )}
          {data.count > 0 && <p className="text-sm text-muted-foreground">{t("count", { count: data.count })}</p>}
        </div>
      </div>

      {data.friends.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t("friends")}</h3>
          <ol className="flex flex-col">
            {data.friends.map((f) => {
              const name = f.displayName || f.username;
              return (
                <li key={f.id} className="flex items-center gap-3 border-b border-dashed border-border py-2 last:border-b-0">
                  <span className="w-16 shrink-0 font-display text-sm font-extrabold text-brand tabular-nums">{number(f.number)}</span>
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
          </ol>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </PaperCard>
  );
}
