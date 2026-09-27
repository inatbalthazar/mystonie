import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export function generateMetadata() {
  return legalMetadata("Terms");
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  setRequestLocale((await params).locale as Locale);
  return <LegalPage doc="Terms" />;
}
