"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, HeartPulse, TimerReset, Zap } from "lucide-react";

type Indicator = {
  key: "endurance" | "recovery" | "activity";
  label: string;
  score: number;
  tone: string;
  summary: string;
  action: string;
};

type ExerciseLog = {
  date: string;
  durationMin: number | null;
  caloriesBurned: string | number | null;
  intensity: "low" | "moderate" | "high" | null;
  note: string | null;
  exerciseName: string | null;
  exerciseCategory: "cardio" | "strength" | "flexibility" | "sport" | "other" | null;
};

type CardioStats = {
  staminaScore: number;
  staminaLabel: string;
  delta: string;
  statusText: string;
  indicators: Indicator[];
};

const cardioNames = ["run", "walk", "jog", "cycle", "bike", "swim", "cardio", "hiit", "hike", "row", "elliptical"];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(date: Date, today: Date) {
  return Math.max(0, Math.floor((startOfDay(today).getTime() - startOfDay(date).getTime()) / 86400000));
}

function isCardioLog(log: ExerciseLog) {
  const name = (log.exerciseName ?? log.note ?? "").toLowerCase();
  return log.exerciseCategory === "cardio" || cardioNames.some((item) => name.includes(item));
}

function labelForScore(score: number) {
  if (score >= 88) return "Excellent";
  if (score >= 76) return "Strong";
  if (score >= 62) return "Good";
  return "Building";
}

function deriveCardioStats(logs: ExerciseLog[]): CardioStats {
  const today = startOfDay(new Date());
  const normalized = logs
    .map((log) => ({
      ...log,
      minutes: Number(log.durationMin || 0),
      loggedAt: startOfDay(new Date(`${log.date}T00:00:00`)),
    }))
    .filter((log) => Number.isFinite(log.minutes) && log.minutes > 0);
  const cardioLogs = normalized.filter(isCardioLog);
  const last7 = normalized.filter((log) => daysBetween(log.loggedAt, today) <= 6);
  const previous7 = normalized.filter((log) => {
    const daysAgo = daysBetween(log.loggedAt, today);
    return daysAgo >= 7 && daysAgo <= 13;
  });
  const cardioLast7 = last7.filter(isCardioLog);
  const cardioPrevious7 = previous7.filter(isCardioLog);
  const allMinutes7 = last7.reduce((sum, log) => sum + log.minutes, 0);
  const cardioMinutes7 = cardioLast7.reduce((sum, log) => sum + log.minutes, 0);
  const cardioMinutesPrevious7 = cardioPrevious7.reduce((sum, log) => sum + log.minutes, 0);
  const activeDays7 = new Set(last7.map((log) => log.date)).size;
  const cardioDays7 = new Set(cardioLast7.map((log) => log.date)).size;
  const highIntensitySessions = last7.filter((log) => log.intensity === "high").length;
  const latestCardio = cardioLogs[0];
  const daysSinceCardio = latestCardio ? daysBetween(latestCardio.loggedAt, today) : null;
  const recentRunWalk = cardioLast7.find((log) => /run|walk|jog|hike/i.test(log.exerciseName ?? ""));

  const enduranceScore = clampScore(32 + cardioMinutes7 * 0.9 + cardioDays7 * 7 + (recentRunWalk ? 6 : 0));
  const activityScore = clampScore(30 + allMinutes7 * 0.65 + activeDays7 * 7);
  const recoveryScore =
    daysSinceCardio == null
      ? 42
      : daysSinceCardio === 0
        ? clampScore(72 - highIntensitySessions * 4)
        : daysSinceCardio <= 2
          ? clampScore(82 - highIntensitySessions * 3)
          : daysSinceCardio <= 5
            ? 64
            : 48;
  const staminaScore = clampScore(enduranceScore * 0.42 + recoveryScore * 0.26 + activityScore * 0.32);
  const staminaLabel = labelForScore(staminaScore);
  const weeklyDelta = cardioMinutes7 - cardioMinutesPrevious7;
  const delta =
    cardioMinutes7 <= 0
      ? "Start this week"
      : cardioMinutesPrevious7 <= 0
        ? `${Math.round(cardioMinutes7)} min this week`
        : `${weeklyDelta >= 0 ? "+" : ""}${Math.round(weeklyDelta)} min this week`;
  const statusText =
    cardioMinutes7 <= 0
      ? "No recent cardio logs yet. A short walk will start building this score."
      : recentRunWalk
        ? `${Math.round(cardioMinutes7)} cardio minutes logged, including ${recentRunWalk.exerciseName?.toLowerCase() ?? "walk/run work"}.`
        : `${Math.round(cardioMinutes7)} cardio minutes logged across ${cardioDays7 || 1} day${cardioDays7 === 1 ? "" : "s"}.`;

  return {
    staminaScore,
    staminaLabel,
    delta,
    statusText,
    indicators: [
      {
        key: "endurance",
        label: "Endurance",
        score: enduranceScore,
        tone: "bg-[#20C7A4]",
        summary:
          cardioMinutes7 > 0
            ? `${Math.round(cardioMinutes7)} min of logged cardio in the last 7 days.`
            : "No logged cardio in the last 7 days.",
        action: cardioMinutes7 >= 90 ? "Keep one easy aerobic session in the week." : "Add a 20-30 min brisk walk, jog, or cycle.",
      },
      {
        key: "recovery",
        label: "Recovery",
        score: recoveryScore,
        tone: "bg-[#3976B9]",
        summary:
          daysSinceCardio == null
            ? "Recovery is estimated because no cardio session is logged."
            : daysSinceCardio === 0
              ? "You logged cardio today, so keep the next effort easy."
              : `Last logged cardio was ${daysSinceCardio} day${daysSinceCardio === 1 ? "" : "s"} ago.`,
        action: highIntensitySessions >= 2 ? "Choose mobility or an easy walk next." : "Use an easy pace and stop before fatigue stacks up.",
      },
      {
        key: "activity",
        label: "Activity",
        score: activityScore,
        tone: "bg-[#E8A33A]",
        summary: `${Math.round(allMinutes7)} total exercise minutes over ${activeDays7} active day${activeDays7 === 1 ? "" : "s"}.`,
        action: activeDays7 >= 4 ? "Keep the rhythm with one light movement day." : "Aim for 3-4 active days this week.",
      },
    ],
  };
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function useIsVisible() {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function EngineIllustration({ animate }: { animate: boolean }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 320" role="img" aria-label="2D heart and lungs stamina illustration">
      <defs>
        <linearGradient id="engineSilhouette" x1="82" x2="278" y1="36" y2="292" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DDF3ED" stopOpacity="0.26" />
          <stop offset="1" stopColor="#20C7A4" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="engineGlow" cx="50%" cy="47%" r="54%">
          <stop stopColor="#8FE3CF" stopOpacity="0.38" />
          <stop offset="1" stopColor="#123F37" stopOpacity="0" />
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="15" floodColor="#082A25" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect width="360" height="320" fill="url(#engineGlow)" />
      <path
        d="M127 48c0 20-31 22-42 57-11 36 1 112 28 154 13 20 35 27 67 27s54-7 67-27c27-42 39-118 28-154-11-35-42-37-42-57 0-18-22-29-53-29s-53 11-53 29Z"
        fill="url(#engineSilhouette)"
        stroke="#9FE8D7"
        strokeOpacity="0.52"
        strokeWidth="2"
      />
      <path
        d="M78 137c25-21 58-34 102-34s77 13 102 34"
        fill="none"
        stroke="#9FE8D7"
        strokeLinecap="round"
        strokeOpacity="0.22"
        strokeWidth="18"
      />
      <path
        d="M118 73c26-11 98-11 124 0M101 122c44-13 114-13 158 0M100 171c45 11 115 11 160 0M118 247c26 13 98 13 124 0"
        fill="none"
        stroke="#DDF3ED"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <path d="M180 31v254M134 45c-19 50-19 173 0 224M226 45c19 50 19 173 0 224" fill="none" stroke="#DDF3ED" strokeOpacity="0.14" strokeWidth="1.5" />

      <g className={animate ? "origin-center animate-[engine-breathe_5.8s_ease-in-out_infinite]" : ""} filter="url(#softShadow)">
        <path
          d="M152 102c-31 10-54 47-51 86 2 30 18 47 42 47 18 0 30-13 30-34v-75c0-20-8-29-21-24Z"
          fill="#8FE3CF"
          fillOpacity="0.9"
        />
        <path
          d="M208 102c31 10 54 47 51 86-2 30-18 47-42 47-18 0-30-13-30-34v-75c0-20 8-29 21-24Z"
          fill="#8FE3CF"
          fillOpacity="0.9"
        />
        <path d="M180 76v75M180 151c-13 5-24 15-32 31M180 151c13 5 24 15 32 31" fill="none" stroke="#DDF3ED" strokeLinecap="round" strokeOpacity="0.72" strokeWidth="8" />
        <path d="M180 76v75M180 151c-13 5-24 15-32 31M180 151c13 5 24 15 32 31" fill="none" stroke="#15483F" strokeLinecap="round" strokeOpacity="0.16" strokeWidth="3" />
      </g>

      <g className={animate ? "origin-center animate-[engine-heart_1.35s_ease-in-out_infinite]" : ""} filter="url(#softShadow)">
        <path
          d="M180 161c-18-29-61-8-47 29 8 22 34 39 47 54 13-15 39-32 47-54 14-37-29-58-47-29Z"
          fill="#20C7A4"
        />
        <path d="M153 184c8 12 17 20 27 28 10-8 19-16 27-28" fill="none" stroke="#15483F" strokeLinecap="round" strokeOpacity="0.24" strokeWidth="6" />
        <circle cx="164" cy="169" r="5" fill="#CFF8ED" fillOpacity="0.48" />
      </g>

      <g opacity="0.74">
        <circle cx="108" cy="235" r="3" fill="#20C7A4" />
        <circle cx="252" cy="235" r="3" fill="#20C7A4" />
        <path d="M111 235c21 14 44 21 69 21s48-7 69-21" fill="none" stroke="#20C7A4" strokeDasharray="6 8" strokeOpacity="0.28" strokeWidth="2" />
      </g>
    </svg>
  );
}

function StaminaRing({ score, label, delta, animate }: { score: number; label: string; delta: string; animate: boolean }) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * score) / 100;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg className="h-[245px] w-[245px] rotate-[-92deg] sm:h-[270px] sm:w-[270px]" viewBox="0 0 188 188" aria-hidden="true">
        <circle cx="94" cy="94" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          className={animate ? "transition-[stroke-dashoffset] duration-700" : ""}
          cx="94"
          cy="94"
          r={radius}
          fill="none"
          stroke="#20C7A4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="9"
        />
      </svg>
      <div className="absolute bottom-5 rounded-full border border-white/12 bg-[#123F37]/82 px-4 py-2 text-center shadow-sm backdrop-blur">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/58">Stamina</p>
        <p className="mt-0.5 text-sm font-black text-white">
          {label} <span className="text-[#8FE3CF]">{delta}</span>
        </p>
      </div>
    </div>
  );
}

function IndicatorButton({ indicator }: { indicator: Indicator }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="w-full rounded-[16px] border border-white/12 bg-white/[0.07] p-3 text-left transition hover:bg-white/[0.1]"
      aria-expanded={open}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-xs font-black text-white/62">{indicator.label}</span>
          <span className="mt-1 block text-xl font-black tabular-nums text-white">{indicator.score}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/52 transition ${open ? "rotate-180" : ""}`} />
      </span>
      <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/12">
        <span className={`block h-full rounded-full ${indicator.tone}`} style={{ width: `${indicator.score}%` }} />
      </span>
      {open && (
        <span className="mt-3 block border-t border-white/10 pt-3 text-xs font-semibold leading-5 text-[#DDF3ED]">
          {indicator.summary} {indicator.action}
        </span>
      )}
    </button>
  );
}

export function HubCardioEngine({ logs = [] }: { logs?: ExerciseLog[] }) {
  const { ref, isVisible } = useIsVisible();
  const reducedMotion = usePrefersReducedMotion();
  const shouldAnimate = isVisible && !reducedMotion;
  const stats = useMemo(() => deriveCardioStats(logs), [logs]);

  return (
    <section ref={ref} className="mt-5 overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.065]">
      <div className="grid gap-4 p-4 sm:p-[18px] lg:grid-cols-[minmax(0,1fr)_190px] lg:items-stretch">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-[#8FE3CF]" />
                <p className="text-[16px] font-black text-white">Cardio Engine</p>
              </div>
              <p className="mt-1 text-sm font-medium leading-5 text-white/62">Heart + lungs stamina view</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#20C7A4]/18 px-3 py-1.5 text-xs font-black text-[#8FE3CF]">
              {stats.staminaScore}/100
            </span>
          </div>

          <div className="relative mt-4 h-[310px] overflow-hidden rounded-[18px] border border-white/12 bg-[#0F3A33] sm:h-[340px]">
            <EngineIllustration animate={shouldAnimate} />
            <StaminaRing score={stats.staminaScore} label={stats.staminaLabel} delta={stats.delta} animate={shouldAnimate} />
          </div>

          <p className="mt-3 text-[11px] font-medium leading-5 text-white/45">
            Decorative wellness animation only. Not a heartbeat, breathing-rate, or diagnostic measurement.
          </p>
        </div>

        <div className="grid min-w-0 gap-2 content-start">
          <div className="rounded-[16px] border border-white/12 bg-white/[0.07] p-3">
            <div className="flex items-center gap-2 text-[#8FE3CF]">
              <Zap className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.1em]">Cardio status</p>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{stats.staminaLabel}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-white/58">{stats.statusText}</p>
          </div>
          {stats.indicators.map((indicator) => (
            <IndicatorButton key={indicator.key} indicator={indicator} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-[#15483F]">
              <Activity className="h-4 w-4" />
              Plan
            </span>
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#20C7A4] px-3 text-xs font-black text-white">
              <TimerReset className="h-4 w-4" />
              Weekly
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
