import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Swastha — Personal Health, Food, and Wellness AI for Nepal",
  description:
    "A mobile-first health platform for Nepal: understand food, track wellness, explain reports, and ask educational health questions with AI.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://openhealth.blog"),
  openGraph: {
    title: "Swastha — Personal Health, Food, and Wellness AI for Nepal",
    description:
      "Understand meals, track wellness, explain reports, and ask educational health questions with a Nepal-focused personal health platform.",
    url: "https://openhealth.blog",
    siteName: "Swastha",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swastha — Personal Health, Food, and Wellness AI for Nepal",
    description:
      "A Nepal-focused personal health, food, wellness, and educational AI platform.",
  },
  keywords: [
    "health AI agent",
    "personal health AI",
    "Nepal health app",
    "AI health assistant",
    "nutrition tracking",
    "sleep tracking",
    "fitness tracking",
    "self-hosted health",
    "mobile-first health app",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Swastha",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const locale = headersList.get("x-locale") || "en";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
