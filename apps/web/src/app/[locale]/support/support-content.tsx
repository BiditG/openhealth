"use client";

import Link from "next/link";
import { Mail, ShieldCheck, Wrench } from "lucide-react";
import { SiteNav } from "@/components/layout/site-nav";

const resources = [
  {
    title: "Documentation",
    desc: "Install the app, configure your account, and start tracking health basics.",
    link: "/docs",
  },
  {
    title: "Privacy Policy",
    desc: "Understand how personal health data, uploads, and AI requests are handled.",
    link: "/privacy",
  },
  {
    title: "Feature Hub",
    desc: "Explore food tracking, AI assistant, reports, progress, hydration, and more.",
    link: "/hub",
  },
];

const faqs = [
  {
    q: "How do I reset my password?",
    a: "Use Supabase email authentication when configured, or contact support@openhealth.blog and we will help you recover access.",
  },
  {
    q: "How do I delete my account?",
    a: "Contact support@openhealth.blog. After identity verification, your account and associated personal data can be deleted.",
  },
  {
    q: "Is this a medical diagnosis app?",
    a: "No. Swastha provides educational information, wellness tracking, and nutrition estimates. It does not diagnose diseases, provide emergency care, or replace qualified clinicians.",
  },
  {
    q: "Can it understand Nepali foods?",
    a: "The architecture is designed for Nepal and South Asian meals, including English, Nepali Unicode, and Romanized Nepali descriptions.",
  },
];

export function SupportContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6 md:pb-24">
        <div className="rounded-2xl border border-border bg-white p-8 dark:bg-card">
          <p className="text-xs font-semibold uppercase text-primary">
            Support
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            How can we help?
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Get help with setup, privacy, account access, and the health tracking tools inside Swastha.
          </p>
        </div>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <Mail className="h-6 w-6 text-primary" />
            <h2 className="mt-6 text-lg font-semibold">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Email us for setup issues, account questions, or feature suggestions.
            </p>
            <a href="mailto:support@openhealth.blog" className="mt-5 inline-block text-sm font-semibold text-primary">
              support@openhealth.blog
            </a>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h2 className="mt-6 text-lg font-semibold">Privacy</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Health information is sensitive. Reports and personal metrics should remain private by default.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="mt-6 text-lg font-semibold">Setup</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Supabase credentials and database migrations are required for account-backed features.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold">Resources</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {resources.map((resource) => (
              <Link key={resource.link} href={resource.link} className="rounded-2xl border border-border bg-white p-6 transition-colors duration-200 hover:border-primary/30 dark:bg-card">
                <h3 className="font-semibold">{resource.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{resource.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-5">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
