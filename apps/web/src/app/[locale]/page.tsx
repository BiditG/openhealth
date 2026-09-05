import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/site-nav";
import { LandingContent } from "./landing-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const descriptions: Record<Locale, string> = {
  en: "FitNMove helps you train smarter, move daily, track progress, and compete with momentum in one mobile-first fitness hub.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: "FitNMove — Train, Move, Compete",
    description: descriptions[lang],
    alternates: {
      canonical: BASE_URL,
      languages: { en: BASE_URL },
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  void locale;

  return (
    <div className="premium-page-bg min-h-screen overflow-x-hidden text-foreground">
      <SiteNav />
      <LandingContent posts={[]} />
    </div>
  );
}
