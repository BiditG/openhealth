import Link from "next/link";
import { Clock3, HeartPulse } from "lucide-react";

export default function PendingActivationPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
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
              Your account was created successfully. You can access Swastha after an admin approves your account.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#DCE7DC] bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-[#F1F6F1]"
            >
              Back home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
