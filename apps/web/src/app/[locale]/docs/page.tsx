import type { Metadata } from "next";
import { DocsContent } from "./docs-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const titles: Record<Locale, string> = {
  en: "Documentation — FitNMove",
};

const descriptions: Record<Locale, string> = {
  en: "Learn how to install FitNMove on your device and enable notifications. Supports iOS, Android, and desktop browsers.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/docs`,
      languages: { en: `${BASE_URL}/docs` },
    },
  };
}

export default function DocsPage() {
  return <DocsContent />;
}
