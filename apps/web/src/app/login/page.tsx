"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { LoginDialog } from "@/components/auth/login-dialog";

export default function LoginPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="rounded-2xl border border-[#DCE7DC] bg-[#F8FAF7] p-6 text-center shadow-sm">
          <Link href="/" className="mx-auto mb-5 flex w-fit items-center gap-2 text-foreground">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF8F1] text-primary">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold">Swastha</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to continue</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Access your hub, progress, food tools, and AI coach after sign in.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#125745]"
          >
            Sign in or create account
          </button>
        </div>
      </section>

      <LoginDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) router.push("/");
        }}
        onSuccess={() => router.push("/hub")}
      />
    </main>
  );
}
