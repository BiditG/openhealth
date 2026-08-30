"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  ChevronRight,
  FileText,
  HeartPulse,
  Lock,
  Salad,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Waves,
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

const primaryActions = [
  {
    href: "/hub/food/scan-label",
    title: "Scan food",
    body: "Calories, macros, and one practical next step.",
    icon: Camera,
  },
  {
    href: "/hub",
    title: "Open hub",
    body: "Food, movement, hydration, sleep, and progress.",
    icon: HeartPulse,
  },
  {
    href: "/hub/chat",
    title: "Ask AI",
    body: "Plain-language answers for everyday wellness.",
    icon: Bot,
  },
];

const rhythmRows = [
  ["Food", "82", "Balanced"],
  ["Water", "6/8", "On track"],
  ["Move", "34m", "Good"],
];

const learnTiles = [
  {
    title: "What changed today?",
    summary: "See the few signals that matter without sorting through a full dashboard.",
  },
  {
    title: "What should I eat next?",
    summary: "Use your recent meals to make the next plate a little easier to balance.",
  },
  {
    title: "What does this report mean?",
    summary: "Turn dense health language into careful, readable explanations.",
  },
];

function HealthSignal() {
  return (
    <div className="pointer-events-none absolute inset-x-5 top-7 h-20 overflow-hidden rounded-lg border border-white/45 bg-white/30 backdrop-blur-sm">
      <svg viewBox="0 0 520 96" className="h-full w-full" role="img" aria-label="Animated wellness signal">
        <path
          d="M0 58 C 40 58, 54 58, 80 58 S 120 58, 144 58 L 164 58 L 176 36 L 190 76 L 208 20 L 228 58 C 264 58, 278 58, 310 58 L 332 58 L 344 42 L 358 68 L 374 50 L 396 58 C 438 58, 470 58, 520 58"
          fill="none"
          stroke="rgba(19, 92, 74, 0.82)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          className="landing-signal-line"
        />
        <path
          d="M0 58 C 40 58, 54 58, 80 58 S 120 58, 144 58 L 164 58 L 176 36 L 190 76 L 208 20 L 228 58 C 264 58, 278 58, 310 58 L 332 58 L 344 42 L 358 68 L 374 50 L 396 58 C 438 58, 470 58, 520 58"
          fill="none"
          stroke="rgba(101, 215, 189, 0.36)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="12"
          className="landing-signal-glow"
        />
      </svg>
    </div>
  );
}

function ProductStage() {
  return (
    <div className="relative mx-auto w-full max-w-[370px] lg:max-w-[420px]">
      <div className="absolute left-1/2 top-10 h-[84%] w-[72%] -translate-x-1/2 rounded-full border border-primary/15" />
      <div className="absolute left-1/2 top-16 h-[70%] w-[58%] -translate-x-1/2 rounded-full border border-[#3976b9]/15" />
      <div className="landing-phone relative mx-auto overflow-hidden rounded-[28px] border border-[#d8e8e2] bg-[#0f1f19] p-2 shadow-[0_24px_80px_rgba(23,32,30,0.14)]">
        <div className="relative overflow-hidden rounded-[22px] bg-[#f8fbf8]">
          <HealthSignal />
          <div className="relative px-5 pb-5 pt-32">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#3976b9]">Today</p>
                <h2 className="mt-1 text-2xl font-semibold leading-tight text-[#17201e]">Your health, simplified.</h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ddf8ef] text-[#12745e]">
                <HeartPulse className="h-5 w-5" strokeWidth={1.8} />
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-[#e1ece8] bg-white">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src="/screenshots/en/01-hub.png"
                  alt="Swastha hub preview"
                  fill
                  className="object-cover object-top"
                  priority
                />
                <span className="landing-scan-beam absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#65d7bd]/35 to-transparent" />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {rhythmRows.map(([label, value, status], index) => (
                <div
                  key={label}
                  className="landing-row flex items-center justify-between rounded-lg border border-[#e4eee9] bg-white px-3 py-2.5"
                  style={{ animationDelay: `${220 + index * 120}ms` }}
                >
                  <span className="text-sm font-medium text-[#52645d]">{label}</span>
                  <span className="text-sm font-semibold text-[#17201e]">{value}</span>
                  <span className="text-xs font-semibold text-[#12745e]">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate px-4 pb-16 pt-24 sm:px-6 lg:pb-24 lg:pt-28">
      <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[linear-gradient(180deg,#effbf6_0%,#f7faf9_58%,rgba(247,250,249,0)_100%)] dark:bg-[linear-gradient(180deg,#13221c_0%,#101513_72%,rgba(16,21,19,0)_100%)]" />
      <div className="absolute inset-x-0 top-16 -z-10 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-[1fr_430px]">
        <div className="landing-hero-copy max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur dark:bg-card/70">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            Built for daily health, not dashboard fatigue
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            Swastha makes health feel simple.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Scan meals, understand reports, ask questions, and see what to do next in one calm mobile-first space.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/hub"
              className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition duration-200 hover:-translate-y-0.5 hover:bg-[#14745e]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
            </Link>
            <Link
              href="/hub/food/scan-label"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white/80 px-5 text-sm font-semibold text-primary backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-muted dark:bg-card/80"
            >
              <Camera className="h-4 w-4" strokeWidth={1.8} />
              Scan a meal
            </Link>
          </div>

          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "Private by design"],
              [Salad, "Nepali food friendly"],
              [TimerReset, "Tiny next steps"],
            ].map(([Icon, label]) => (
              <div key={label as string} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm dark:bg-card">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                {label as string}
              </div>
            ))}
          </div>
        </div>

        <ProductStage />
      </div>
    </section>
  );
}

function ActionGrid() {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-3 md:grid-cols-3">
          {primaryActions.map(({ href, title, body, icon: Icon }, index) => (
            <Link
              key={title}
              href={href}
              className="landing-action group rounded-lg border border-border bg-white/82 p-5 backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-white dark:bg-card/82"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">One daily rhythm</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Less tracking. More clarity.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
            Swastha turns food, activity, hydration, reports, and questions into a clean status you can understand quickly.
          </p>
        </div>

        <div className="relative rounded-lg border border-border bg-white p-4 dark:bg-card sm:p-5">
          <div className="absolute left-8 right-8 top-1/2 h-px bg-gradient-to-r from-primary/10 via-primary/50 to-[#3976b9]/25" />
          <div className="relative grid gap-3 sm:grid-cols-4">
            {[
              [Camera, "Scan"],
              [FileText, "Explain"],
              [TrendingUp, "Track"],
              [Waves, "Adjust"],
            ].map(([Icon, label], index) => (
              <div
                key={label as string}
                className="landing-step rounded-lg border border-border bg-background p-4 text-center dark:bg-background"
                style={{ animationDelay: `${180 + index * 130}ms` }}
              >
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBand() {
  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 rounded-lg border border-border bg-[#10231d] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[#65d7bd]">
            <Lock className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="text-sm leading-6 text-white/80">
            Educational wellness guidance only. Your health data stays personal, and medical claims stay careful.
          </p>
        </div>
        <Link href="/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-[#9ee7d5]">
          Privacy
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </section>
  );
}

function LearnPreview({ posts }: { posts: BlogPost[] }) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Learn</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">Plain answers for real days.</h2>
          </div>
          <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Explore lessons
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {posts.length > 0
            ? posts.slice(0, 3).map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="landing-action overflow-hidden rounded-lg border border-border bg-white transition duration-200 hover:-translate-y-1 hover:border-primary/40 dark:bg-card"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  {post.thumbnailUrl && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image src={post.thumbnailUrl} alt={post.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">{post.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.summary}</p>
                  </div>
                </Link>
              ))
            : learnTiles.map((tile, index) => (
                <div
                  key={tile.title}
                  className="landing-action rounded-lg border border-border bg-white p-5 dark:bg-card"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <h3 className="text-base font-semibold leading-snug text-foreground">{tile.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tile.summary}</p>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-4 pb-10 pt-8 sm:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-5 border-t border-border pt-7 sm:flex-row sm:items-center">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <HeartPulse className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-semibold text-foreground">Swastha</p>
            <p className="text-sm text-muted-foreground">Health made simple.</p>
          </div>
        </Link>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/hub">Hub</Link>
          <Link href="/learn">Learn</Link>
          <Link href="/support">Support</Link>
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
      <ActionGrid />
      <FlowSection />
      <TrustBand />
      <LearnPreview posts={posts} />
      <Footer />
    </>
  );
}
