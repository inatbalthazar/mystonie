import { ChevronRightIcon, DownloadIcon, FileSpreadsheetIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeedbackLink } from "@/components/beta/feedback-link";
import { DeleteAccount } from "@/components/delete-account";
import { ShowGettingStarted } from "@/components/getting-started";
import { PaperCard } from "@/components/paper-card";
import { PushSwitch } from "@/components/pwa/push";
import { RawgAttribution } from "@/components/rawg-attribution";
import { SignOutForm } from "@/components/pwa/sign-out-form";
import { Preferences } from "@/components/settings/preferences";
import { ProfileForm } from "@/components/settings/profile-form";
import { SettingSwitch } from "@/components/settings/setting-switch";
import { isTheme } from "@/core/account";
import { localizedPath } from "@/core/auth";
import { isOAuthProvider, type OAuthProvider } from "@/core/avatar";
import { countryOptions, isCountryCode } from "@/core/countries";
import { isAdminEmail } from "@/core/journal-posts";
import { pushConfig } from "@/data/push";
import { getProState } from "@/data/subscriptions";
import { SupportLink } from "@/components/support-link";
import { NotInAndroidApp } from "@/components/pwa/not-in-android-app";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { userClient } from "@/data/supabase-server";
import { avoidTopicIds } from "@/data/warnings";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { BETA } from "@/lib/site";

const PROVIDER_LABEL = {
  google: "providerGoogle",
  apple: "providerApple",
  facebook: "providerFacebook",
  twitter: "providerTwitter",
  discord: "providerDiscord",
} as const satisfies Record<OAuthProvider, string>;

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

  const [{ data: profile }, t, tw, tl, avoid] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, bio, avatar_url, time_zone, country, theme, visibility, email_recaps, reel_reminders, atlas_public")
      .eq("id", user.id)
      .single(),
    getTranslations("Settings"),
    getTranslations("Warnings"),
    getTranslations("Legal"),
    avoidTopicIds(supabase, user.id),
  ]);
  const pushKey = pushConfig()?.publicKey;
  const team = isAdminEmail(process.env.ADMIN_EMAILS, user.email);
  const pro = await getProState(supabase, user.id).catch(() => null);
  const rows: [string, string][] = [
    [t("email"), user.email ?? ""],
    [
      t("signedInWith"),
      isOAuthProvider(user.app_metadata.provider) ? t(PROVIDER_LABEL[user.app_metadata.provider]) : t("providerEmail"),
    ],
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-12 pb-10">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      {profile && (
        <>
          <PaperCard>
            <h2 className="mb-4 font-display text-lg font-bold">{t("profile")}</h2>
            <ProfileForm username={profile.username} displayName={profile.display_name} bio={profile.bio} avatarUrl={profile.avatar_url} />
          </PaperCard>
          <PaperCard>
            <h2 className="mb-3 font-display text-lg font-bold">{t("privacy")}</h2>
            <div className="flex flex-col gap-4">
              <SettingSwitch setting="publicProfile" initial={profile.visibility === "public"} />
              <SettingSwitch setting="atlasPublic" initial={profile.atlas_public} />
            </div>
          </PaperCard>
          <PaperCard>
            <h2 className="mb-4 font-display text-lg font-bold">{t("preferences")}</h2>
            <Preferences
              timeZone={profile.time_zone}
              timeZones={timeZones()}
              country={isCountryCode(profile.country) ? profile.country : null}
              countries={countryOptions(locale)}
              theme={isTheme(profile.theme) ? profile.theme : "system"}
            />
          </PaperCard>
          <PaperCard>
            <h2 className="font-display text-lg font-bold">{tw("title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tw("settingsBody")}</p>
            <p className="mt-3 text-sm font-semibold">{tw("settingsCount", { count: avoid.length })}</p>
            <Link
              href="/settings/warnings"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
            >
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
              {tw("settingsLink")}
            </Link>
          </PaperCard>
          <PaperCard>
            <h2 className="mb-3 font-display text-lg font-bold">{t("gettingStarted")}</h2>
            <ShowGettingStarted />
          </PaperCard>
          <PaperCard>
            <h2 className="mb-3 font-display text-lg font-bold">{t("emails")}</h2>
            <SettingSwitch setting="emailRecaps" initial={profile.email_recaps} />
          </PaperCard>
          {pushKey && (
            <PaperCard>
              <h2 className="mb-3 font-display text-lg font-bold">{t("notifications")}</h2>
              <PushSwitch publicKey={pushKey}>
                {/* Reel of the Day reminders (ADR 0054). */}
                <SettingSwitch setting="reelReminders" initial={profile.reel_reminders} />
              </PushSwitch>
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
      {/* Beta (ADR 0055): what it means, and "Report a problem". */}
      <PaperCard stamp={BETA ? t("betaStamp") : undefined}>
        <h2 className="font-display text-lg font-bold">{BETA ? t("betaTitle") : t("feedbackTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("betaBody")}</p>
        <FeedbackLink place="button" className="mt-4" />
      </PaperCard>
      {/* While Pro isn't on sale (the beta), /pro still shows what it will add. */}
      <PaperCard stamp={pro?.pro ? t("proStamp") : undefined}>
        <h2 className="font-display text-lg font-bold">{t("proTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{!pro?.available ? t("proSoon") : pro.pro ? t("proActive") : t("proBody")}</p>
        <Link href="/pro" className="mt-4 inline-flex h-11 items-center rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press">
          {pro?.pro ? t("proManage") : t("proLink")}
        </Link>
      </PaperCard>
      {/* Tips stay on the web: Google Play wants payments in an app through its own billing (ADR 0097). */}
      <NotInAndroidApp>
        <PaperCard>
          <h2 className="font-display text-lg font-bold">{t("supportTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("supportBody")}</p>
          <SupportLink place="settings" />
        </PaperCard>
      </NotInAndroidApp>
      {/* What a website keeps in its footer; signed in, the footer only credits the data (ADR 0065). */}
      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("aboutTitle")}</h2>
        <nav aria-label={t("aboutTitle")} className="mt-2 divide-y divide-dashed divide-border">
          {(
            [
              ["/privacy", tl("privacy")],
              ["/terms", tl("terms")],
              // The team's review of members' Journal articles (ADR 0092), for ADMIN_EMAILS accounts only.
              // The team's welcome desk and Team label (ADR 0098).
              ...(team
                ? ([
                    ["/admin/journal", t("teamReview")],
                    ["/admin/members", t("teamWelcome")],
                  ] as const)
                : []),
            ] as const
          ).map(([href, label]) => (
            <Link key={href} href={href} className="flex h-12 items-center justify-between gap-3 font-semibold hover:text-brand">
              {label}
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-border pt-4">
          <TmdbAttribution />
          <RawgAttribution className="text-left" />
        </div>
      </PaperCard>
      <PaperCard>
        <h2 className="font-display text-lg font-bold">{t("importTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("importBody")}</p>
        <Link
          href="/settings/import"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
        >
          <UploadIcon className="size-4" aria-hidden="true" />
          {t("importLink")}
        </Link>
      </PaperCard>
      <section className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border p-5">
        <h2 className="font-display text-lg font-bold">{t("yourData")}</h2>
        <p className="text-sm text-muted-foreground">{t("exportBody")}</p>
        {/* A plain link: the browser downloads the file (Content-Disposition), no script needed. */}
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/account/export"
            download
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
            {t("exportButton")}
          </a>
          {/* The collection as spreadsheets that import back (S3 import & export). */}
          <a
            href="/api/account/export/csv"
            download
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
          >
            <FileSpreadsheetIcon className="size-4" aria-hidden="true" />
            {t("exportCsvButton")}
          </a>
        </div>
      </section>
      <DeleteAccount />
    </main>
  );
}
