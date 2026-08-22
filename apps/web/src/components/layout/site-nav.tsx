"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { path: "/today", label: "Health" },
  { path: "/learn", label: "Learn" },
  { path: "/pro", label: "Pro" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-background/90">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:h-16">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <HeartPulse className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Swastha</span>
            <span className="hidden text-xs text-muted-foreground sm:block">Health for Nepal</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map(({ path, label }) => {
            const isActive = path === "/" ? pathname === "/" : pathname.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-primary",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#125745]"
          >
            <LogIn className="h-4 w-4" strokeWidth={1.8} />
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
