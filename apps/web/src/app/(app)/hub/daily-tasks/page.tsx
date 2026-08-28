"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Crown,
  Dumbbell,
  Loader2,
  Medal,
  PartyPopper,
  Play,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { RankBadge } from "@/components/ranks/rank-badge";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

const tierStyles = {
  bronze: "border-amber-200 bg-amber-50 text-amber-700",
  silver: "border-slate-200 bg-slate-50 text-slate-700",
  gold: "border-yellow-200 bg-yellow-50 text-yellow-700",
  platinum: "border-[#20C7A4]/30 bg-[#EAF8F4] text-[#123F37]",
  training: "border-[#20C7A4]/30 bg-[#EAF8F4] text-[#123F37]",
};

type TaskView = {
  key: string;
  title: string;
  description: string;
  category: string;
  area: string;
  actionType: "analyzer" | "tracker" | "onsite";
  targetReps?: number;
  targetDistanceMeters?: number;
  countedReps: number;
  completedAt: Date | string | null;
  status: string;
  medal: {
    tier: string;
    points: number;
  };
};

type LevelUpState = {
  title: string;
  tier: number;
  points: number;
} | null;

function playMetalClick() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    gain.connect(ctx.destination);

    [220, 820].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? "square" : "triangle";
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.12);
      osc.connect(gain);
      osc.start(now + index * 0.025);
      osc.stop(now + 0.16);
    });
    window.setTimeout(() => void ctx.close(), 260);
  } catch {
    // Non-critical: browsers may block audio in some contexts.
  }
}

function taskIcon(category: string) {
  if (category === "Task") return Utensils;
  if (category === "Mission") return Crown;
  return Dumbbell;
}

function TaskCard({
  task,
  onStart,
  onComplete,
  starting,
  completing,
}: {
  task: TaskView;
  onStart: () => void;
  onComplete: () => void;
  starting: boolean;
  completing: boolean;
}) {
  const Icon = taskIcon(task.category);
  const isComplete = !!task.completedAt;
  const isStarted = task.status === "started";
  return (
    <article
      className={cn(
        "grid gap-4 rounded-[18px] border p-4 transition sm:grid-cols-[1fr_auto]",
        isComplete ? "border-[#20C7A4]/30 bg-[#EAF8F4]" : "border-[#E3EAE7] bg-white"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#123F37]">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[#17201E]">{task.title}</h3>
            <span className={cn("rounded-full border px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em]", tierStyles[task.medal.tier as keyof typeof tierStyles])}>
              {task.medal.points} pts
            </span>
            <span className="rounded-full bg-[#F7FAF9] px-2 py-1 text-[11px] font-bold text-[#6B7773]">{task.area}</span>
          </div>
          <p className="mt-1 text-sm leading-5 text-[#6B7773]">{task.description}</p>
          {task.targetReps && (
            <p className="mt-2 text-xs font-semibold text-[#123F37]">
              Verified reps: {task.countedReps}/{task.targetReps}
            </p>
          )}
          {task.targetDistanceMeters && (
            <p className="mt-2 text-xs font-semibold text-[#123F37]">
              GPS target: {(task.targetDistanceMeters / 1000).toFixed(1)} km
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {isComplete ? (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#123F37] px-4 text-sm font-semibold text-white">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </span>
        ) : task.actionType === "analyzer" || task.actionType === "tracker" ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#123F37] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isStarted ? "Resume" : "Start"}
          </button>
        ) : (
          <>
            <Link href="/hub" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E3EAE7] px-4 text-sm font-semibold text-[#123F37]">
              Open
              <ChevronRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onComplete}
              disabled={completing}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#20C7A4] px-4 text-sm font-semibold text-[#123F37] disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tick complete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function DailyTasksPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [celebration, setCelebration] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUpState>(null);
  const { data: daily, isLoading } = trpc.tasks.getDaily.useQuery();
  const startTask = trpc.tasks.startTask.useMutation({
    onSuccess: async (data) => {
      await utils.tasks.getDaily.invalidate();
      router.push(data.actionHref);
    },
    onError: (error) => toast.error(error.message),
  });
  const completeTask = trpc.tasks.completeTask.useMutation({
    onSuccess: async (data) => {
      await utils.tasks.getDaily.invalidate();
      setCelebration(data.medal.name);
      if (data.levelUp) {
        playMetalClick();
        setLevelUp({ title: data.rankAfter.title, tier: data.rankAfter.tier, points: data.points });
        window.setTimeout(() => setLevelUp(null), 3600);
      }
      toast.success(data.message);
      window.setTimeout(() => setCelebration(null), 2400);
    },
    onError: (error) => toast.error(error.message),
  });
  const progressPct = useMemo(() => {
    if (!daily?.totalCount) return 0;
    return Math.round((daily.completedCount / daily.totalCount) * 100);
  }, [daily]);
  const simpleTasks = daily?.tasks.filter((task) => task.category === "Task") ?? [];
  const missions = daily?.tasks.filter((task) => task.category === "Mission") ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#20C7A4]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAF9] px-4 py-5 sm:px-6 lg:px-0">
      {celebration && (
        <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-sm overflow-hidden rounded-[18px] border border-[#20C7A4]/30 bg-white p-4 text-center shadow-xl animate-in slide-in-from-top-4 fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF8F4] text-[#123F37] animate-medal-pop">
            <Medal className="h-8 w-8" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#17201E]">Medal unlocked</p>
          <p className="mt-1 text-lg font-black text-[#123F37]">{celebration}</p>
        </div>
      )}

      {levelUp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#07110F]/86 px-4 animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-amber-300/60 bg-[#101614] p-7 text-center text-white shadow-[0_0_60px_rgba(251,191,36,0.24)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-amber-300 to-[#20C7A4]" />
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-200">Promotion unlocked</p>
            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/70 bg-white/10 shadow-[0_0_35px_rgba(251,191,36,0.35)] animate-medal-pop">
              <RankBadge points={levelUp.points} showTitle={false} className="scale-150" />
            </div>
            <h2 className="mt-6 text-4xl font-black uppercase tracking-[0.18em] text-white">{levelUp.title}</h2>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Tier {levelUp.tier}</p>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Your total score is now {levelUp.points.toLocaleString()} points. Rank icon upgraded across your profile and leaderboard.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-[24px] bg-[#123F37] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Tasks</p>
        <h1 className="mt-3 text-3xl font-black tracking-normal">Daily tasks & weekly missions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Daily tasks refresh every day with easy new actions. Weekly missions stay for the week and reward harder verified effort.
        </p>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#20C7A4] transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-white/80">
          {daily?.completedTaskCount ?? 0}/{daily?.taskCount ?? 0} tasks • {daily?.completedMissionCount ?? 0}/{daily?.missionCount ?? 0} missions
        </p>
        {daily?.allComplete && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#123F37]">
            <PartyPopper className="h-4 w-4 text-[#20C7A4]" />
            All tasks complete today.
          </div>
        )}
      </section>

      <section className="mt-5 space-y-3">
        <div>
          <h2 className="text-xl font-black text-[#17201E]">Tasks</h2>
          <p className="mt-1 text-sm text-[#6B7773]">Daily, easy, and refreshed with a new mix every day.</p>
        </div>
        {simpleTasks.map((task) => (
          <TaskCard
            key={task.key}
            task={task}
            onStart={() => startTask.mutate({ taskKey: task.key })}
            onComplete={() => completeTask.mutate({ taskKey: task.key, source: "website" })}
            starting={startTask.isPending}
            completing={completeTask.isPending}
          />
        ))}
      </section>

      <section className="mt-6 space-y-3">
        <div>
          <h2 className="text-xl font-black text-[#17201E]">Missions</h2>
          <p className="mt-1 text-sm text-[#6B7773]">Weekly, harder, and worth more leaderboard points.</p>
        </div>
        {missions.map((task) => (
          <TaskCard
            key={task.key}
            task={task}
            onStart={() => startTask.mutate({ taskKey: task.key })}
            onComplete={() => completeTask.mutate({ taskKey: task.key, source: "website" })}
            starting={startTask.isPending}
            completing={completeTask.isPending}
          />
        ))}
      </section>
    </div>
  );
}
