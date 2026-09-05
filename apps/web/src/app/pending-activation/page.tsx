import Link from "next/link";
import { Clock3, HeartPulse, PlayCircle } from "lucide-react";
import { ProPlans } from "@/components/pro/pro-plans";

export default function PendingActivationPage() {
  return (
    <main className="premium-page-bg min-h-screen px-4 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-[#DCE7DC] bg-[#F8FAF7] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF8F1] text-primary">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#9A5B00]">
              <Clock3 className="h-5 w-5" />
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Account pending
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Waiting for admin activation
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Your account was created successfully. After payment and admin verification, Pro activation may take around 24 hours.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/demo"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#123F37] px-4 text-sm font-medium text-white transition-colors hover:bg-[#15483F]"
            >
              <PlayCircle className="h-4 w-4" />
              Try limited demo
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#DCE7DC] bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-[#F1F6F1]"
            >
              Back home
            </Link>
          </div>
        </div>

        <ProPlans compact showDemoLink />
      </section>
    </main>
  );
}
