import type { Metadata } from "next";
import { SupportContent } from "./support-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const titles: Record<Locale, string> = {
  en: "Support — FitNMove",
};

const descriptions: Record<Locale, string> = {
  en: "Need help? Check the FAQ, documentation, or contact the FitNMove support team via email.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/support`,
      languages: { en: `${BASE_URL}/support` },
    },
  };
}

export default function SupportPage() {
  return <SupportContent />;
}
