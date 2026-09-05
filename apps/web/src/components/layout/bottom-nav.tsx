"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Home, LineChart, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/hub", label: "Home", icon: Home },
  { href: "/hub/progress", label: "Progress", icon: LineChart },
  { href: "/hub/food/scan-label", label: "Explore", icon: Camera, featured: true },
  { href: "/hub/tasks", label: "Ranks", icon: Trophy },
  { href: "/settings", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav data-testid="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#153D33] bg-[#041A15]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-[#041A15]/90 lg:hidden">
      <div className="mx-auto grid h-[70px] max-w-lg grid-cols-5 items-center px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors duration-200",
                item.featured
                  ? "-mt-6 text-primary"
                  : isActive
                    ? "text-[#B8F34A]"
                    : "text-[#8BA59B]",
              )}
              aria-label={item.label}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  item.featured
                    ? "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(184,243,74,0.25)]"
                    : isActive
                      ? "bg-[#10372D]"
                      : "",
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
