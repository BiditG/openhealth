import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/site-nav";
import { LandingContent } from "./landing-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const descriptions: Record<Locale, string> = {
  en: "A mobile-first health platform for Nepal: understand food, track wellness, explain reports, and ask educational health questions with AI.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: "Swastha — Personal Health, Food, and Wellness AI for Nepal",
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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteNav />
      <LandingContent posts={[]} />
    </div>
  );
}
