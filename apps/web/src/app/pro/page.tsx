import Link from "next/link";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { ProPlans } from "@/components/pro/pro-plans";

export default function ProPage() {
  return (
    <main className="min-h-screen bg-[#F7FAF9] px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E3EAE7] bg-white px-4 text-sm font-bold text-[#123F37]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link href="/" className="flex items-center gap-2 text-[#123F37]">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#EAF8F4]">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="text-base font-black">Swastha Pro</span>
          </Link>
        </div>

        <div className="mb-8 rounded-[28px] bg-[#123F37] p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Launch pricing</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-normal">Choose Pro and get full Swastha access after activation.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Pay through eSewa using the QR or account number. Admin activation usually happens within around 24 hours.
          </p>
        </div>

        <ProPlans showDemoLink />
      </section>
    </main>
  );
}
