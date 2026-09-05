"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function NavigationLoader() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    let timeout: number | undefined;

    const showBriefly = () => {
      window.clearTimeout(timeout);
      setPending(true);
      timeout = window.setTimeout(() => setPending(false), 2400);
    };

    const handleClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target || anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;

      showBriefly();
    };

    const handleSubmit = () => showBriefly();

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90]" role="status" aria-live="polite" aria-label="Loading page">
      <div className="h-1 overflow-hidden bg-primary/15">
        <div className="h-full w-1/2 animate-fitnmove-loader bg-primary" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-border bg-white/92 px-3 py-2 text-xs font-black uppercase text-primary shadow-sm backdrop-blur dark:bg-card/92">
        <span className="relative h-5 w-5 overflow-hidden rounded-md bg-white">
          <Image src="/icons/Logo.png" alt="" fill sizes="20px" className="object-contain" />
        </span>
        Loading FitNMove
      </div>
    </div>
  );
}
