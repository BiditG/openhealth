import type { Metadata } from "next";
import { PricingContent } from "./pricing-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const titles: Record<Locale, string> = {
  en: "Pricing - Swastha",
};

const descriptions: Record<Locale, string> = {
  en: "Swastha pricing and deployment options for a Nepal-focused personal health platform.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/pricing`,
      languages: { en: `${BASE_URL}/pricing` },
    },
  };
}

export default function PricingPage() {
  return <PricingContent />;
}
