import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FitNMove — Train, Move, Compete",
  description:
    "FitNMove helps you train smarter, move daily, track progress, and compete with momentum in one mobile-first fitness hub.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://openhealth.blog"),
  openGraph: {
    title: "FitNMove — Train, Move, Compete",
    description:
      "Train smarter, move daily, track progress, and compete with momentum in one mobile-first fitness hub.",
    url: "https://openhealth.blog",
    siteName: "FitNMove",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FitNMove — Train, Move, Compete",
    description:
      "A mobile-first fitness hub for training, movement, progress, and competition.",
  },
  keywords: [
    "FitNMove",
    "Train Move Compete",
    "fitness app",
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
    title: "FitNMove",
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
