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
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

const tierStyles = {
  bronze: "border-amber-200 bg-amber-50 text-amber-700",
  silver: "border-slate-200 bg-slate-50 text-slate-700",
  gold: "border-yellow-200 bg-yellow-50 text-yellow-700",
  platinum: "border-[#20C7A4]/30 bg-[#EAF8F4] text-[#123F37]",
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

      <section className="rounded-[24px] bg-[#123F37] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Tasks</p>
        <h1 className="mt-3 text-3xl font-black tracking-normal">Daily tasks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Start exercise tasks inside Swastha. Analyzer tasks unlock only after verified reps.
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
          <p className="mt-1 text-sm text-[#6B7773]">Simple supporting actions that build consistency.</p>
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
          <p className="mt-1 text-sm text-[#6B7773]">Harder verified challenges with much higher leaderboard value.</p>
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
