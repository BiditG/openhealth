import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/site-nav";
import { LearnContent } from "./learn-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

export const dynamic = "force-static";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const descriptions: Record<Locale, string> = {
  en: "Structured wellness courses for yoga, gym training, meditation, nutrition, sleep, and mobility from Swastha.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: "Learn — Swastha Courses",
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/learn`,
      languages: { en: `${BASE_URL}/learn` },
    },
  };
}

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <LearnContent />
    </div>
  );
}
