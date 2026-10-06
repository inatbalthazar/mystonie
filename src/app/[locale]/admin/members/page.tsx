import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FollowButton } from "@/components/social/follow-button";
import { PersonRow } from "@/components/social/person-row";
import { StampButton } from "@/components/social/stamp-button";
import { TeamLabelToggle } from "@/components/social/team-label-toggle";
import { teamMember } from "@/data/admin";
import { adminClient } from "@/data/supabase-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Welcome");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * The team's welcome desk (ADR 0098): the Team label on your own account, and the newest members with their latest
 * finish, to Stamp or follow by hand. It's the team member's own account doing it, so every Stamp and follow here is a
 * real person's. Only for an account signed in with an `ADMIN_EMAILS` address; anyone else gets a 404.
 */
export default async function WelcomeDeskPage({ params }: PageProps<"/[locale]/admin/members">) {
  setRequestLocale((await params).locale as Locale);
  const admin = adminClient();
  const team = await teamMember();
  if (!team || !admin) notFound();

  const [{ data: me }, { data: members, error }, t, format] = await Promise.all([
    admin.from("profiles").select("official").eq("id", team.userId).maybeSingle(),
    admin.rpc("newest_members", { p_viewer: team.userId, p_limit: 40 }),
    getTranslations("Welcome"),
    getFormatter(),
  ]);
  if (error) throw new Error(`newest_members failed: ${error.message}`);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <section aria-labelledby="team-label" className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <h2 id="team-label" className="font-display text-xl font-extrabold">
          {t("labelTitle")}
        </h2>
        <TeamLabelToggle on={me?.official === "team"} />
      </section>

      <section aria-labelledby="new-members" className="flex flex-col gap-2">
        <h2 id="new-members" className="font-display text-2xl font-extrabold">
          {t("newTitle")}
          <span className="ml-2 text-base text-muted-foreground">{members.length}</span>
        </h2>
        {members.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-5 text-center text-muted-foreground">{t("nobody")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-2">
                <PersonRow
                  person={{ username: m.username, displayName: m.display_name ?? null, avatarUrl: m.avatar_url ?? null }}
                  note={` · ${t("joined", { when: format.relativeTime(new Date(m.joined_at)) })}`}
                  action={<FollowButton userId={m.id} following={m.i_follow} via="welcome" />}
                />
                <div className="flex items-center justify-between gap-3 pl-13 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {m.entry_id && m.title_name ? t("latest", { title: m.title_name }) : t("finished", { count: m.finished })}
                    {m.entry_id && ` · ${t("finished", { count: m.finished })}`}
                  </span>
                  {m.entry_id && <StampButton entryId={m.entry_id} stamped={m.stamped} count={m.stamp_count} mine={false} compact />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
