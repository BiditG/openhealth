"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Droplets,
  FileText,
  HeartPulse,
  Lock,
  Salad,
  ShieldCheck,
  TrendingUp,
  Upload,
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  thumbnailUrl: string | null;
  tags: string[] | null;
  videoPublishedAt: Date | null;
  createdAt: Date;
}

const tools = [
  {
    href: "/hub/food/scan-label",
    title: "Snap Food",
    body: "Understand calories and nutrition.",
    icon: Camera,
  },
  {
    href: "/hub/chat",
    title: "Ask Health AI",
    body: "Get simple wellness explanations.",
    icon: Bot,
  },
  {
    href: "/hub/documents",
    title: "Upload Report",
    body: "Read lab values in plain language.",
    icon: Upload,
  },
  {
    href: "/today",
    title: "Track Health",
    body: "See your food, water, and trends.",
    icon: HeartPulse,
  },
];

function ProductPhone() {
  return (
    <div className="mx-auto w-full max-w-[320px] rounded-2xl border border-border bg-[#17211d] p-2.5">
      <div className="overflow-hidden rounded-xl bg-[#fafaf7]">
        <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Today</p>
            <p className="text-base font-semibold text-foreground">Dal Bhat Tarkari</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">Meal score</span>
        </div>
        <div className="p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#ddf3eb]">
            <Image
              src="/screenshots/en/04-food-search.png"
              alt="Swastha food analysis preview"
              fill
              className="object-cover object-top"
              priority
            />
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-4xl font-semibold leading-none text-primary">82</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Great balance</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-foreground">620</p>
              <p className="text-sm text-muted-foreground">kcal</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["Protein", "21g"],
              ["Carbs", "89g"],
              ["Fiber", "12g"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-white p-3">
                <p className="text-base font-semibold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-muted p-4">
            <p className="text-sm font-semibold text-primary">Try this</p>
            <p className="mt-1 text-sm leading-6 text-[#315149]">Add a little more vegetables to balance the rice portion.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="px-4 pb-20 pt-24 sm:px-6 lg:pb-24 lg:pt-28">
      <div className="mx-auto grid max-w-[1120px] items-center gap-14 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Personal health, food, and wellness for Nepal</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            Understand your health, one day at a time.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Scan your meals, track your health, understand your reports, and get simple AI-powered guidance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/hub/food/scan-label"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#125745]"
            >
              <Camera className="h-4 w-4" strokeWidth={1.8} />
              Snap My Food
            </Link>
            <Link
              href="/hub"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-medium text-primary transition-colors hover:bg-muted dark:bg-card"
            >
              Explore Health Tools
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Private by design", "Nepali food friendly", "Educational, not diagnostic"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={1.8} />
                {item}
              </div>
            ))}
          </div>
        </div>
        <ProductPhone />
      </div>
    </section>
  );
}

function ValueStatement() {
  return (
    <section className="border-y border-border bg-white px-4 py-12 sm:px-6 dark:bg-card">
      <div className="mx-auto max-w-[920px] text-center">
        <p className="text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          A health companion for everyday decisions, not a dashboard you have to manage.
        </p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Open Swastha, understand what matters today, and take one small next step.
        </p>
      </div>
    </section>
  );
}

function ToolCards() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">What can you do?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Start with the task that matters right now.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map(({ href, title, body, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-2xl border border-border bg-white p-6 transition-colors duration-200 hover:border-primary/30 dark:bg-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="mt-6 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExampleSections() {
  return (
    <section className="bg-background px-4 py-20 sm:px-6 dark:bg-background">
      <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-3">
        {[
          {
            icon: Salad,
            title: "Food scanner example",
            body: "See calories, protein, carbs, fat, and one gentle improvement idea after scanning a meal.",
          },
          {
            icon: TrendingUp,
            title: "Health dashboard example",
            body: "Track the basics without tiny widgets: water, weight, meals, steps, and recent changes.",
          },
          {
            icon: Bot,
            title: "AI assistant example",
            body: "Ask common questions like HbA1c, ghee, protein, or blood pressure in simple language.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <Icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
            <h3 className="mt-6 text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Built for trust.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Health data is personal. Swastha keeps explanations calm, privacy visible, and medical claims limited.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [ShieldCheck, "General wellness information, not diagnosis."],
            [Lock, "Your reports and health data stay private."],
            [FileText, "Reference ranges stay visible where available."],
            [Droplets, "Delete your information anytime."],
          ].map(([Icon, text]) => (
            <div key={text as string} className="flex gap-3 rounded-xl border border-border bg-white p-4 dark:bg-card">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
              <p className="text-sm leading-6 text-muted-foreground">{text as string}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlogPreview({ posts }: { posts: BlogPost[] }) {
  return (
    <section className="bg-muted px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Learn in plain language.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Short explanations for everyday health choices.</p>
          </div>
          <Link href="/learn" className="inline-flex items-center gap-2 font-semibold text-primary">
            Explore courses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-white p-6 text-muted-foreground">
            Articles will appear here once your content database is connected.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="overflow-hidden rounded-2xl border border-border bg-white">
                {post.thumbnailUrl && (
                  <div className="relative aspect-video overflow-hidden">
                    <Image src={post.thumbnailUrl} alt={post.title} fill className="object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="line-clamp-2 text-base font-semibold text-foreground">{post.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-[760px] text-center">
        <h2 className="text-2xl font-semibold text-foreground">Start with your next meal.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A small, clear health habit is easier to keep than a complicated dashboard.
        </p>
        <Link
          href="/hub/food/scan-label"
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#125745]"
        >
          Snap My Food
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white px-4 py-10 sm:px-6 dark:bg-card">
      <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
            <HeartPulse className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Swastha</p>
            <p className="text-sm text-muted-foreground">Understand your health, one day at a time.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/hub/food/scan-label">Food</Link>
          <Link href="/hub/chat">AI Assistant</Link>
          <Link href="/hub/documents">Reports</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingContent({ posts }: { posts: BlogPost[] }) {
  return (
    <>
      <Hero />
      <ValueStatement />
      <ToolCards />
      <ExampleSections />
      <TrustSection />
      <BlogPreview posts={posts} />
      <FinalCta />
      <Footer />
    </>
  );
}
