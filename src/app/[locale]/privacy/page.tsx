import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export function generateMetadata() {
  return legalMetadata("Privacy");
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  setRequestLocale((await params).locale as Locale);
  return <LegalPage doc="Privacy" />;
}
