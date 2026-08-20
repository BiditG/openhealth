"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ChevronRight,
  Crown,
  GraduationCap,
  LayoutGrid,
  Lock,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { deleteAccount } from "@/server/actions/account";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const menuItems = [
  { href: "/settings/profile", labelKey: "settings:profile" as const, icon: User, description: "Personal details and health profile" },
  { href: "/settings/subscription", labelKey: "settings:subscription" as const, icon: Crown, description: "Plan and billing" },
  { href: "/settings/coaching", labelKey: "settings:coaching" as const, icon: GraduationCap, description: "Coaching preferences" },
  { href: "/settings/hub-config", labelKey: "settings:hubConfig" as const, icon: LayoutGrid, description: "Choose visible tools" },
];

const themeOptions = [
  { value: "light", labelKey: "theme.light" as const, icon: Sun },
  { value: "dark", labelKey: "theme.dark" as const, icon: Moon },
  { value: "system", labelKey: "theme.system" as const, icon: Monitor },
] as const;

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation(["common", "settings"]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/hub");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      router.push("/login");
    } catch {
      toast.error(t("settings:deleteAccountError"));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="mx-auto max-w-[760px] space-y-6 px-4 py-6">
      <section>
        <p className="text-sm font-semibold text-primary">Profile</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">{t("settings:title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Manage your account, preferences, and privacy in one place.
        </p>
      </section>

      {session?.user && (
        <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <User className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{session.user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <h2 className="text-lg font-semibold text-foreground">{t("theme.label")}</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                theme === option.value
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="h-4 w-4" strokeWidth={1.8} />
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-3 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between gap-4 rounded-2xl p-3 transition-colors hover:bg-secondary/70"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <item.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-base font-semibold text-foreground">{t(item.labelKey)}</span>
                <span className="block text-sm text-muted-foreground">{item.description}</span>
              </span>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-secondary p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
          <div>
            <h2 className="text-base font-semibold text-foreground">Privacy and trust</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Your health data stays private. You can export or delete your information anytime.
            </p>
          </div>
        </div>
      </section>

      {session?.user && (
        <section className="space-y-3">
          <button
            onClick={handleSignOut}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground dark:bg-card"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
            {t("auth.logout")}
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              {t("settings:deleteAccount")}
            </button>
          ) : (
            <div className="rounded-2xl border border-destructive/20 bg-white p-5 dark:bg-card">
              <div className="flex gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" strokeWidth={1.8} />
                <div>
                  <p className="text-base font-semibold text-destructive">{t("settings:deleteAccountConfirmTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("settings:deleteAccountConfirmMessage")}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  {t("settings:deleteAccountCancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="min-h-11 rounded-xl bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : t("settings:deleteAccountConfirm")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
