"use client";

import { useSession } from "@/lib/auth-client";
import { Bell, Camera, HeartPulse, LineChart, ListChecks, Route, Search, Trophy, User, Utensils } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useTranslation } from "react-i18next";

const navItems = [
  { href: "/hub/notifications", label: "Notifications", icon: Bell },
  { href: "/hub/daily-tasks", label: "Tasks", icon: ListChecks },
  { href: "/hub/tasks", label: "Leaderboard", icon: Trophy },
  { href: "/hub/track", label: "Track", icon: Route },
  { href: "/hub/food", label: "Food", icon: Utensils },
  { href: "/hub/progress", label: "Progress", icon: LineChart },
];

export function Header() {
  const { data: session } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:bg-background/90">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 lg:h-[72px] lg:px-6">
          <Link href="/hub" className="flex items-center gap-2.5 text-foreground transition-opacity duration-200 hover:opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
              <HeartPulse className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-lg font-bold leading-none tracking-tight">Swastha</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                <item.icon className="h-4 w-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            ))}
          </nav>

          {session?.user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/hub/food/scan-label"
                className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#0D8064] md:inline-flex"
              >
                <Camera className="h-4 w-4" strokeWidth={2} />
                Snap meal
              </Link>
              <Link
                href="/hub/food/search"
                className="hidden h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:bg-muted hover:text-primary sm:flex dark:bg-card"
                aria-label="Search foods"
              >
                <Search className="h-5 w-5" strokeWidth={1.8} />
              </Link>
              <Link
                href="/settings/profile"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary text-primary transition-colors hover:bg-muted dark:bg-card"
                aria-label="Profile"
              >
                <User className="h-5 w-5" strokeWidth={1.8} />
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#0D8064]"
            >
              {t("auth.login")}
            </button>
          )}
        </div>
      </header>

      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </>
  );
}
