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
  en: "Structured courses for training, movement, nutrition, sleep, and mobility from FitNMove.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: "Learn — FitNMove Courses",
    description: descriptions[lang],
    alternates: {
      canonical: `${BASE_URL}/learn`,
      languages: { en: `${BASE_URL}/learn` },
    },
  };
}

export default function LearnPage() {
  return (
    <div className="premium-page-bg min-h-screen text-foreground">
      <SiteNav />
      <LearnContent />
    </div>
  );
}
