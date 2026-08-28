"use client";

import { useSession } from "@/lib/auth-client";
import { Bell, Camera, Crown, HeartPulse, LineChart, ListChecks, Route, Search, Trophy, User, Utensils, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc-client";
import { RANKS, getRankProgress } from "@/lib/rank-system";
import { RankIcon } from "@/components/ranks/rank-badge";
import { toast } from "sonner";

const navItems = [
  { href: "/hub/notifications", label: "Notifications", icon: Bell },
  { href: "/hub/daily-tasks", label: "Tasks", icon: ListChecks },
  { href: "/hub/tasks", label: "Leaderboard", icon: Trophy },
  { href: "/hub/track", label: "Track", icon: Route },
  { href: "/hub/food", label: "Food", icon: Utensils },
  { href: "/hub/progress", label: "Progress", icon: LineChart },
  { href: "/settings/subscription", label: "Pro", icon: Crown },
];

export function Header() {
  const { data: session } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: achievementStats } = trpc.tasks.getMyStats.useQuery(undefined, {
    enabled: Boolean(session?.user),
  });
  const rankProgress = getRankProgress(achievementStats?.points ?? 0);
  const claimDailyLogin = trpc.tasks.claimDailyLogin.useMutation({
    onSuccess: (data) => {
      if (data.claimed) {
        toast.success(data.message);
        void utils.tasks.getMyStats.invalidate();
        void utils.tasks.getLeaderboard.invalidate();
      }
    },
  });

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || claimDailyLogin.isPending) return;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `openhealth-daily-login-${userId}-${today}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Server-side uniqueness still prevents duplicate daily rewards.
    }
    claimDailyLogin.mutate();
  }, [claimDailyLogin, session?.user?.id]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:bg-background/90">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-2 px-3 sm:px-4 lg:h-[72px] lg:px-6">
          <Link href="/hub" className="flex min-w-0 shrink-0 items-center gap-2 text-foreground transition-opacity duration-200 hover:opacity-80 sm:gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
              <HeartPulse className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="hidden text-lg font-bold leading-none tracking-tight min-[380px]:inline">Swastha</span>
          </Link>

          <nav className="flex items-center gap-1 lg:hidden">
            {navItems.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`h-10 items-center justify-center gap-1.5 rounded-xl bg-[#EAF8F4] px-2.5 text-[#123F37] ${
                  item.label === "Notifications" ? "hidden min-[520px]:inline-flex" : "inline-flex"
                }`}
                aria-label={item.label}
              >
                <item.icon className="h-5 w-5" strokeWidth={1.8} />
                {item.label === "Tasks" && <span className="text-xs font-bold">Tasks</span>}
              </Link>
            ))}
          </nav>

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
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowRanks(true)}
                className="hidden min-h-11 max-w-[190px] items-center gap-2 rounded-xl border border-[#DDE8E4] bg-[#F7FAF9] px-3 text-left text-[#123F37] shadow-sm transition hover:border-[#20C7A4]/60 sm:inline-flex"
                aria-label={`Rank ${rankProgress.current.title}, ${(achievementStats?.points ?? 0).toLocaleString()} points`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  <RankIcon rank={rankProgress.current} className="h-5 w-5" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[11px] font-black uppercase tracking-[0.12em]">{rankProgress.current.title}</span>
                  <span className="block text-xs font-bold text-muted-foreground">{(achievementStats?.points ?? 0).toLocaleString()} pts</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowRanks(true)}
                className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-[#DDE8E4] bg-[#F7FAF9] px-2.5 text-[#123F37] transition hover:border-[#20C7A4]/60 max-[360px]:px-0 sm:hidden"
                aria-label={`Rank ${rankProgress.current.title}, ${(achievementStats?.points ?? 0).toLocaleString()} points`}
              >
                <RankIcon rank={rankProgress.current} className="h-5 w-5" />
                <span className="text-[10px] font-black tabular-nums max-[360px]:hidden">{(achievementStats?.points ?? 0).toLocaleString()}</span>
              </button>
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-primary transition-colors hover:bg-muted dark:bg-card"
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

      {showRanks && session?.user ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-2 sm:items-center sm:justify-center sm:p-3">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-[24px] sm:p-5 dark:bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Your rank</p>
                <h2 className="mt-1 truncate text-2xl font-black text-foreground">{rankProgress.current.title}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {(achievementStats?.points ?? 0).toLocaleString()} total points
                  {rankProgress.next ? ` • ${rankProgress.pointsToNext.toLocaleString()} pts until ${rankProgress.next.title}` : " • Max rank reached"}
                </p>
              </div>
              <button type="button" onClick={() => setShowRanks(false)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${rankProgress.progressPct}%` }} />
            </div>
            <div className="mt-5 space-y-2">
              {RANKS.map((rank) => {
                const reached = (achievementStats?.points ?? 0) >= rank.pointsNeeded;
                const current = rank.key === rankProgress.current.key;
                return (
                  <div
                    key={rank.key}
                    className={`grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-3 min-[420px]:grid-cols-[44px_minmax(0,1fr)_auto] ${
                      current ? "border-primary bg-secondary" : "border-border bg-white dark:bg-card"
                    }`}
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full border ${rank.toneClass}`}>
                      <RankIcon rank={rank} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-foreground">{rank.title}</span>
                      <span className="block text-xs text-muted-foreground">{rank.pointsNeeded.toLocaleString()} pts required</span>
                    </span>
                    <span className="col-span-2 rounded-full bg-secondary px-2.5 py-1 text-center text-[11px] font-black text-primary min-[420px]:col-span-1">
                      {current ? "Current" : reached ? "Unlocked" : `${Math.max(0, rank.pointsNeeded - (achievementStats?.points ?? 0)).toLocaleString()} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </>
  );
}
