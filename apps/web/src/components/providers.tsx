"use client";

import "@/lib/i18n"; // Initialize i18next (side-effect)
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { httpBatchLink } from "@trpc/client";
import { ThemeProvider } from "next-themes";
import { trpc } from "@/lib/trpc-client";
import { PostHogProvider } from "@/components/posthog-provider";
import { PostHogPageView } from "@/components/posthog-pageview";
import { MiniKitProvider } from "@/components/minikit-provider";

// Workaround: React 18/19 types mismatch in monorepo causes children prop errors
const Theme = ThemeProvider as React.FC<{
  children: React.ReactNode;
  attribute: string;
  defaultTheme: string;
  enableSystem: boolean;
}>;

let persister: ReturnType<typeof createSyncStoragePersister> | undefined;
try {
  if (typeof window !== "undefined") {
    persister = createSyncStoragePersister({ storage: window.localStorage });
  }
} catch {
  // localStorage unavailable (e.g. Safari private browsing) — fall back to non-persisted
  persister = undefined;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 24 * 60 * 60 * 1000, // 24h — keep cache across app restarts
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  const inner = (
    <MiniKitProvider>
      <PostHogProvider>
        <PostHogPageView />
        <Theme attribute="class" defaultTheme="light" enableSystem={false}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            {children}
          </trpc.Provider>
        </Theme>
      </PostHogProvider>
    </MiniKitProvider>
  );

  // PersistQueryClientProvider already includes QueryClientProvider
  if (persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
      >
        {inner}
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {inner}
    </QueryClientProvider>
  );
}
