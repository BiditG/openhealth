"use client";

import { Bell, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function NotificationsPage() {
  const { data: daily, isLoading } = trpc.tasks.getDaily.useQuery();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#20C7A4]" />
      </div>
    );
  }

  return (
    <div className="premium-page-bg min-h-screen px-4 py-5 sm:px-6 lg:px-0">
      <section className="rounded-[24px] bg-[#123F37] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Notifications</p>
        <h1 className="mt-3 text-3xl font-black tracking-normal">Daily health guidance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Simple prompts that tell users what the day needs, without making them decode health numbers.
        </p>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {daily?.notifications.map((item) => (
          <article key={item.id} className="rounded-[20px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#123F37]">
              <Bell className="h-6 w-6" />
            </div>
            <p className="mt-4 text-lg font-black text-[#17201E]">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-[#6B7773]">{item.body}</p>
          </article>
        ))}
        {!daily?.notifications.length && (
          <div className="rounded-[20px] border border-[#E3EAE7] bg-white p-5 text-sm text-[#6B7773]">
            <Sparkles className="mb-3 h-5 w-5 text-[#20C7A4]" />
            No guidance yet. Check back after your profile is ready.
          </div>
        )}
      </section>
    </div>
  );
}
