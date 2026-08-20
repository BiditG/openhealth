import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { DeferredProviders } from "@/components/layout/deferred-providers";
import { requireActiveUser } from "@/server/authz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireActiveUser();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DeferredProviders />
      <PullToRefresh>
        <main className="relative z-0 mx-auto w-full max-w-[1120px] px-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:px-6">
          {children}
        </main>
      </PullToRefresh>
      <BottomNav />
    </div>
  );
}
