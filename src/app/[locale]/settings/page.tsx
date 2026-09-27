import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteAccount } from "@/components/delete-account";
import { PaperCard } from "@/components/paper-card";
import { PushSwitch } from "@/components/pwa/push";
import { SignOutForm } from "@/components/pwa/sign-out-form";
import { Preferences } from "@/components/settings/preferences";
import { ProfileForm } from "@/components/settings/profile-form";
import { SettingSwitch } from "@/components/settings/setting-switch";
import { isTheme } from "@/core/account";
import { localizedPath } from "@/core/auth";
import { pushConfig } from "@/data/push";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** Every IANA zone this server knows, plus UTC (the default, which some runtimes leave out of the list). */
function timeZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** Account settings (S1 profile & privacy; the proxy sends signed-out visitors to /auth). */
export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/settings", locale, routing.defaultLocale);

  const supabase = await userClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, t] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url, time_zone, theme, visibility, email_recaps")
      .eq("id", user.id)
      .single(),
    getTranslations("Settings"),
  ]);
  const pushKey = pushConfig()?.publicKey;
  const rows: [string, string][] = [
    [t("email"), user.email ?? ""],
    [t("signedInWith"), user.app_metadata.provider === "google" ? t("providerGoogle") : t("providerEmail")],
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-12 pb-10">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      {profile && (
        <>
          <PaperCard>
            <h2 className="mb-4 font-display text-lg font-bold">{t("profile")}</h2>
            <ProfileForm username={profile.username} displayName={profile.display_name} avatarUrl={profile.avatar_url} />
          </PaperCard>
          <PaperCard>
            <h2 className="mb-3 font-display text-lg font-bold">{t("privacy")}</h2>
            <SettingSwitch setting="publicProfile" initial={profile.visibility === "public"} />
          </PaperCard>
          <PaperCard>
            <h2 className="mb-4 font-display text-lg font-bold">{t("preferences")}</h2>
            <Preferences
              timeZone={profile.time_zone}
              timeZones={timeZones()}
              theme={isTheme(profile.theme) ? profile.theme : "system"}
            />
          </PaperCard>
          <PaperCard>
            <h2 className="mb-3 font-display text-lg font-bold">{t("emails")}</h2>
            <SettingSwitch setting="emailRecaps" initial={profile.email_recaps} />
          </PaperCard>
          {pushKey && (
            <PaperCard>
              <h2 className="mb-3 font-display text-lg font-bold">{t("notifications")}</h2>
              <PushSwitch publicKey={pushKey} />
            </PaperCard>
          )}
        </>
      )}
      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("account")}</h2>
        <dl className="mt-3 divide-y divide-dashed divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="min-w-0 font-medium break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <SignOutForm next={localizedPath("/", locale, routing.defaultLocale)} />
      </PaperCard>
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border p-5">
        <h2 className="font-display text-lg font-bold">{t("yourData")}</h2>
        <p className="text-sm text-muted-foreground">{t("exportBody")}</p>
        {/* A plain link: the browser downloads the file (Content-Disposition), no script needed. */}
        <a
          href="/api/account/export"
          download
          className="inline-flex h-11 items-center gap-2 self-start rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted"
        >
          <DownloadIcon className="size-4" aria-hidden="true" />
          {t("exportButton")}
        </a>
      </section>
      <DeleteAccount />
    </main>
  );
}
