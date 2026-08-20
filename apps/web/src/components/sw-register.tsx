"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER !== "true") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates on page load
        registration.update().catch((e) => console.warn("[SW] Update check failed:", e));

        // Listen for new SW waiting to activate
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available — prompt user to refresh
              toast("A new version is available", {
                description: "Refresh to update",
                action: {
                  label: "Refresh",
                  onClick: () => {
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  },
                },
                duration: Infinity, // Keep toast visible until user acts
              });
            }
          });
        });
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });

  }, []);

  return null;
}
