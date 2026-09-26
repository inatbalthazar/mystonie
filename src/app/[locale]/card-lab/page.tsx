import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "next-intl";
import { CardLab } from "@/cards/card-lab";
import { siteUrl } from "@/lib/site";

// Development tool for card templates and the Playwright screenshot tests. Never in production.
export default async function CardLabPage({ params }: PageProps<"/[locale]/card-lab">) {
  if (process.env.NODE_ENV === "production" && process.env.CARD_LAB !== "1") notFound();
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <CardLab host={siteUrl().host} />;
}
