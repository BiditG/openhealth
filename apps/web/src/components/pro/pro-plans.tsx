"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Clock3, Crown, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import { ESEWA_ACCOUNT, ESEWA_QR_SRC, PRO_FEATURES, PRO_PLANS, SUPPORT_PHONE, SUPPORT_WHATSAPP_URL } from "@/lib/pro-plan";
import { cn } from "@/lib/utils";

type ProPlansProps = {
  compact?: boolean;
  showDemoLink?: boolean;
};

export function ProPlans({ compact = false, showDemoLink = false }: ProPlansProps) {
  return (
    <section className={cn("space-y-5", compact ? "" : "mx-auto max-w-6xl")}>
      <div className={cn("grid gap-4", compact ? "md:grid-cols-3" : "lg:grid-cols-[1fr_360px]")}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {PRO_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  "relative rounded-[22px] border bg-white p-5 shadow-sm",
                  plan.highlight ? "border-[#20C7A4] shadow-[0_14px_34px_rgba(32,199,164,0.16)]" : "border-[#E3EAE7]"
                )}
              >
                {plan.highlight && (
                  <span className="absolute right-4 top-4 rounded-full bg-[#123F37] px-3 py-1 text-xs font-black text-white">
                    Best value
                  </span>
                )}
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#123F37]">
                  <Crown className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-black text-[#17201E]">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-black tracking-normal text-[#17201E]">{plan.price}</span>
                  <span className="ml-1 text-sm font-semibold text-[#6B7773]">/ {plan.period}</span>
                </p>
                <p className="mt-3 text-sm leading-6 text-[#6B7773]">{plan.note}</p>
              </article>
            ))}
          </div>

          <div className="rounded-[22px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#123F37]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-[#17201E]">What Pro includes</h3>
                <p className="text-sm text-[#6B7773]">Pay through eSewa, then admin activates your plan manually.</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-[#17201E]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#20C7A4]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!compact && <PaymentCard showDemoLink={showDemoLink} />}
      </div>

      {compact && <PaymentCard showDemoLink={showDemoLink} />}
    </section>
  );
}

function PaymentCard({ showDemoLink }: { showDemoLink: boolean }) {
  return (
    <aside className="rounded-[24px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Manual payment</p>
          <h3 className="mt-1 text-xl font-black text-[#17201E]">eSewa Pro activation</h3>
        </div>
        <QrCode className="h-6 w-6 text-[#123F37]" />
      </div>

      <div className="mt-5 overflow-hidden rounded-[18px] border border-[#E3EAE7] bg-[#F7FAF9] p-3">
        <Image
          src={ESEWA_QR_SRC}
          alt="eSewa payment QR"
          width={420}
          height={420}
          className="mx-auto aspect-square w-full max-w-[280px] rounded-[14px] object-contain"
          priority={false}
        />
      </div>

      <div className="mt-4 rounded-[18px] bg-[#EAF8F4] p-4">
        <p className="text-xs font-bold uppercase text-[#6B7773]">eSewa account</p>
        <p className="mt-1 text-2xl font-black tabular-nums text-[#123F37]">{ESEWA_ACCOUNT}</p>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-6">
          After payment, subscriptions may take around 24 hours to become active while the admin verifies and activates your account.
        </p>
      </div>

      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123F37] px-4 text-sm font-bold text-white transition-colors hover:bg-[#15483F]"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp assistance: {SUPPORT_PHONE}
      </a>

      {showDemoLink && (
        <Link
          href="/demo"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#E3EAE7] bg-white px-4 text-sm font-bold text-[#123F37] transition-colors hover:bg-[#F7FAF9]"
        >
          Try limited demo while waiting
        </Link>
      )}
    </aside>
  );
}
