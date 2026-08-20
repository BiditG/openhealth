"use client";

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Leaf,
  Moon,
  PlayCircle,
  Salad,
  StretchHorizontal,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryId = "yoga" | "gym" | "meditation" | "nutrition" | "sleep" | "mobility";

interface Course {
  title: string;
  level: "Beginner" | "Intermediate" | "All levels";
  duration: string;
  lessons: number;
  summary: string;
  outcomes: string[];
  modules: string[];
}

interface LearnCategory {
  id: CategoryId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  courses: Course[];
}

const categories: LearnCategory[] = [
  {
    id: "yoga",
    label: "Yoga",
    description: "Gentle strength, flexibility, breathing, and daily body awareness.",
    icon: Leaf,
    courses: [
      {
        title: "Yoga Foundations",
        level: "Beginner",
        duration: "14 days",
        lessons: 18,
        summary: "Learn basic poses, safe alignment, breathing rhythm, and short routines for daily practice.",
        outcomes: ["Build a 15-minute home routine", "Improve posture and mobility", "Learn calm breathing basics"],
        modules: ["Breath and posture", "Sun salutation basics", "Hip and spine mobility", "Relaxation practice"],
      },
      {
        title: "Morning Energy Flow",
        level: "All levels",
        duration: "10 days",
        lessons: 12,
        summary: "Short morning flows designed to wake up the body without feeling intense or rushed.",
        outcomes: ["Start the day with movement", "Reduce stiffness", "Create a repeatable morning habit"],
        modules: ["Wake-up mobility", "Standing flow", "Core support", "Cool-down breathing"],
      },
      {
        title: "Yoga for Back Care",
        level: "Beginner",
        duration: "21 days",
        lessons: 20,
        summary: "A calm progression for back-friendly movement, gentle stretching, and posture support.",
        outcomes: ["Release common tension areas", "Strengthen support muscles", "Know when to avoid pushing"],
        modules: ["Back-safe principles", "Hamstrings and hips", "Core stability", "Desk posture resets"],
      },
    ],
  },
  {
    id: "gym",
    label: "Gym (Weights)",
    description: "Strength training plans for safer lifting, muscle gain, fat loss, and confidence.",
    icon: Dumbbell,
    courses: [
      {
        title: "Weight Training Basics",
        level: "Beginner",
        duration: "4 weeks",
        lessons: 24,
        summary: "Learn the main lifts, proper warmups, progressive overload, and recovery basics.",
        outcomes: ["Train full body safely", "Understand sets and reps", "Build a simple weekly plan"],
        modules: ["Gym orientation", "Squat and hinge", "Push and pull", "Progress tracking"],
      },
      {
        title: "Muscle Gain Program",
        level: "Intermediate",
        duration: "8 weeks",
        lessons: 32,
        summary: "A structured hypertrophy path with exercise selection, volume guidance, and nutrition support.",
        outcomes: ["Build consistent training volume", "Improve form quality", "Plan protein and recovery"],
        modules: ["Upper body split", "Lower body split", "Accessory lifts", "Recovery and deloads"],
      },
      {
        title: "Fat Loss Strength Plan",
        level: "All levels",
        duration: "6 weeks",
        lessons: 26,
        summary: "A balanced plan combining strength, steps, and simple nutrition habits without crash dieting.",
        outcomes: ["Keep strength while losing fat", "Use cardio wisely", "Create sustainable food habits"],
        modules: ["Strength priority", "Conditioning basics", "Meal structure", "Weekly check-ins"],
      },
    ],
  },
  {
    id: "meditation",
    label: "Meditation",
    description: "Simple practices for focus, stress, sleep, and emotional steadiness.",
    icon: Brain,
    courses: [
      {
        title: "Meditation Starter",
        level: "Beginner",
        duration: "7 days",
        lessons: 10,
        summary: "Short guided practices for learning how to sit, breathe, notice thoughts, and return attention.",
        outcomes: ["Meditate for 5 minutes", "Understand wandering thoughts", "Build a calm routine"],
        modules: ["Breath attention", "Body scan", "Working with thoughts", "Daily reflection"],
      },
      {
        title: "Stress Reset",
        level: "All levels",
        duration: "14 days",
        lessons: 16,
        summary: "Practical meditations and breathing tools for stressful workdays, travel, and busy evenings.",
        outcomes: ["Calm the nervous system", "Pause before reacting", "Use breathing during stress"],
        modules: ["Two-minute resets", "Grounding practice", "Evening release", "Self-kindness"],
      },
      {
        title: "Sleep Wind Down",
        level: "All levels",
        duration: "10 days",
        lessons: 12,
        summary: "A gentle night practice to reduce mental noise and prepare the body for sleep.",
        outcomes: ["Create a bedtime cue", "Relax the body", "Reduce late-night rumination"],
        modules: ["Breath slowing", "Progressive relaxation", "Quiet mind practice", "Sleep reflection"],
      },
    ],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    description: "Everyday food education for Nepali meals, protein, calories, and balance.",
    icon: Salad,
    courses: [
      {
        title: "Balanced Nepali Plate",
        level: "Beginner",
        duration: "10 days",
        lessons: 14,
        summary: "Learn how to balance dal bhat, tarkari, achar, snacks, and tea without making food stressful.",
        outcomes: ["Estimate plate balance", "Add protein confidently", "Improve meals without restriction"],
        modules: ["Plate method", "Protein at meals", "Rice portions", "Vegetables and fiber"],
      },
      {
        title: "Protein Made Simple",
        level: "Beginner",
        duration: "7 days",
        lessons: 9,
        summary: "Understand protein needs, vegetarian options, eggs, dairy, meat, lentils, and practical portions.",
        outcomes: ["Know daily protein basics", "Choose affordable options", "Plan protein across the day"],
        modules: ["Why protein matters", "Local protein sources", "Meal examples", "Common mistakes"],
      },
      {
        title: "Weight Management Basics",
        level: "All levels",
        duration: "21 days",
        lessons: 22,
        summary: "A calm course on calories, hunger, habits, walking, sleep, and consistency.",
        outcomes: ["Understand energy balance", "Build sustainable habits", "Avoid extreme dieting"],
        modules: ["Calorie awareness", "Satiety", "Weekly planning", "Plate review"],
      },
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    description: "Better sleep routines, evening habits, caffeine timing, and recovery basics.",
    icon: Moon,
    courses: [
      {
        title: "Sleep Foundations",
        level: "Beginner",
        duration: "14 days",
        lessons: 15,
        summary: "Build a consistent wind-down routine and understand the habits that affect sleep quality.",
        outcomes: ["Create a bedtime routine", "Improve sleep timing", "Reduce evening stimulation"],
        modules: ["Sleep pressure", "Light and screens", "Caffeine timing", "Wind-down habits"],
      },
      {
        title: "Recovery for Active People",
        level: "All levels",
        duration: "2 weeks",
        lessons: 12,
        summary: "Sleep, rest days, hydration, and nutrition basics for people who train or walk often.",
        outcomes: ["Support training recovery", "Notice fatigue signs", "Plan rest without guilt"],
        modules: ["Recovery signals", "Rest days", "Food and hydration", "Sleep tracking"],
      },
    ],
  },
  {
    id: "mobility",
    label: "Mobility",
    description: "Short routines for desk posture, hips, shoulders, neck, and daily movement.",
    icon: StretchHorizontal,
    courses: [
      {
        title: "Desk Mobility",
        level: "Beginner",
        duration: "7 days",
        lessons: 8,
        summary: "Simple movement breaks for people who sit for long hours at work or study.",
        outcomes: ["Reduce stiffness", "Move during the day", "Support neck and shoulder comfort"],
        modules: ["Neck reset", "Shoulder opening", "Hip mobility", "Micro-break routine"],
      },
      {
        title: "Full Body Mobility",
        level: "All levels",
        duration: "21 days",
        lessons: 21,
        summary: "A daily progression for ankles, hips, spine, shoulders, and breathing mechanics.",
        outcomes: ["Move with more ease", "Improve range of motion", "Build a 10-minute routine"],
        modules: ["Ankles and hips", "Spine rotation", "Shoulders", "Integrated flow"],
      },
    ],
  },
];

export function LearnContent() {
  const [activeId, setActiveId] = useState<CategoryId>("yoga");
  const activeCategory = useMemo(() => categories.find((category) => category.id === activeId) ?? categories[0], [activeId]);
  const ActiveIcon = activeCategory.icon;
  const featuredCourse = activeCategory.courses[0];

  return (
    <main className="px-4 pb-20 pt-24 sm:px-6 lg:pt-28">
      <section className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Learn</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Build healthier habits with guided courses.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose a field like Yoga, Gym, Meditation, Nutrition, Sleep, or Mobility and follow clear lessons made for everyday life.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#courses" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#125745]">
              Explore Courses
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/hub" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-medium text-primary transition-colors hover:bg-muted dark:bg-card">
              Open My Health Home
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
              <HeartPulse className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Today&apos;s lesson</p>
              <p className="text-sm text-muted-foreground">10 minutes</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-background p-5">
            <p className="text-xs font-semibold uppercase text-primary">{featuredCourse.title}</p>
            <p className="mt-2 text-xl font-semibold leading-tight text-foreground">{featuredCourse.modules[0]}</p>
            <div className="mt-5 flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary" strokeWidth={1.8} />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-2/5 rounded-full bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="courses" className="mx-auto mt-16 max-w-[1120px]">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = category.id === activeId;
            return (
              <button
                key={category.id}
                onClick={() => setActiveId(category.id)}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-muted-foreground hover:bg-muted hover:text-primary dark:bg-card",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <ActiveIcon className="h-7 w-7 text-primary" strokeWidth={1.8} />
            <h2 className="mt-5 text-xl font-semibold text-foreground">{activeCategory.label}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{activeCategory.description}</p>
            <div className="mt-7 space-y-3">
              {[
                ["Courses", activeCategory.courses.length],
                ["Lessons", activeCategory.courses.reduce((sum, course) => sum + course.lessons, 0)],
                ["Best for", "Daily habit"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {activeCategory.courses.map((course) => (
              <CourseCard key={course.title} course={course} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] rounded-2xl border border-border bg-white p-6 sm:p-7 dark:bg-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Course Detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{featuredCourse.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{featuredCourse.summary}</p>
          </div>
          <Link href="/hub" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[#125745]">
            Start in App
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_300px]">
          <div>
            <h3 className="text-base font-semibold text-foreground">Course modules</h3>
            <div className="mt-4 space-y-3">
              {featuredCourse.modules.map((module, index) => (
                <div key={module} className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{module}</p>
                    <p className="text-sm text-muted-foreground">{index === 0 ? "Start here" : "Guided lesson and practice"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-muted p-5">
            <h3 className="text-base font-semibold text-foreground">You will learn</h3>
            <div className="mt-4 space-y-3">
              {featuredCourse.outcomes.map((outcome) => (
                <div key={outcome} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <p className="text-sm leading-6 text-muted-foreground">{outcome}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-[1120px] gap-5 md:grid-cols-3">
        {[
          [Timer, "Short lessons", "Most lessons fit into 5 to 15 minutes."],
          [CheckCircle2, "Practical habits", "Courses focus on actions you can repeat."],
          [HeartPulse, "Health-aware", "Guidance stays calm, safe, and educational."],
        ].map(([Icon, title, body]) => (
          <div key={title as string} className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
            <Icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
            <h3 className="mt-5 text-lg font-semibold text-foreground">{title as string}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body as string}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <article className="rounded-2xl border border-border bg-white p-6 dark:bg-card">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-primary">{course.level}</span>
        <span className="text-xs font-semibold text-muted-foreground">{course.duration}</span>
      </div>
      <h3 className="mt-6 text-lg font-semibold leading-snug text-foreground">{course.title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{course.summary}</p>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">{course.lessons} lessons</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          View details
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
