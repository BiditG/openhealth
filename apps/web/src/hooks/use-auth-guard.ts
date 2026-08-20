"use client";

import { useState, useCallback } from "react";
import { useSession } from "@/lib/auth-client";

export function useAuthGuard() {
  const { data: session, isPending } = useSession();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const isAuthenticated = !!session?.user;

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isPending) return;
      if (isAuthenticated) {
        action();
      } else {
        setShowLoginDialog(true);
      }
    },
    [isAuthenticated, isPending]
  );

  return {
    isAuthenticated,
    showLoginDialog,
    setShowLoginDialog,
    requireAuth,
    user: session?.user ?? null,
    isPending,
  };
}
