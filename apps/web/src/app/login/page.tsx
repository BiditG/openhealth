"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useSession } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    setOpen(false);
    router.replace("/hub");
  }, [router, session?.user]);

  const handleSuccess = () => {
    setOpen(false);
    router.replace("/hub");
    router.refresh();
  };

  return (
    <main className="premium-page-bg min-h-screen px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="rounded-2xl border border-[#35D39A]/20 bg-[#0B2C24]/90 p-6 text-center shadow-sm backdrop-blur">
          <Link href="/" className="mx-auto mb-5 flex w-fit items-center gap-2 text-[#F4F8F5]">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#10372D]">
              <Image src="/icons/Logo.png" alt="" fill sizes="40px" className="object-contain" />
            </span>
            <span className="text-base font-semibold">FitNMove</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F4F8F5]">Sign in to continue</h1>
          <p className="mt-2 text-sm leading-6 text-[#C0D1CA]">
            Access your training hub, movement progress, nutrition tools, and competition streaks after sign in.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#C8FA69] active:bg-[#9ED52E]"
          >
            Sign in or create account
          </button>
        </div>
      </section>

      <LoginDialog
        open={open && !isPending && !session?.user}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
