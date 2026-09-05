import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const titles: Record<Locale, string> = {
  en: "Privacy Policy - FitNMove",
};

const descriptions: Record<Locale, string> = {
  en: "How FitNMove collects, uses, and protects your health data and personal information.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/privacy`,
      languages: { en: `${BASE_URL}/privacy` },
    },
  };
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
