"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronRight,
  Clock,
  Dumbbell,
  History,
  ListChecks,
  Plus,
} from "lucide-react";
import { startWorkout } from "@/server/actions/workout";

export default function WorkoutPage() {
  const router = useRouter();
  const [startingLog, setStartingLog] = useState(false);

  const startBlankLog = async () => {
    setStartingLog(true);
    try {
      await startWorkout({});
      router.push("/hub/workout/active");
    } catch {
      toast.error("Could not start workout log.");
    } finally {
      setStartingLog(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-black leading-tight text-[#17201E]">Workout</h1>
          <p className="mt-1 text-sm leading-5 text-[#6B7773]">
            Choose how you want to train today.
          </p>
        </div>
        <Link
          href="/hub/workout/stats"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DDE8E4] bg-white text-[#15483F] shadow-sm"
          aria-label="Workout stats"
        >
          <BarChart3 className="h-5 w-5" />
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/hub/workout/quick"
          className="group min-h-[164px] rounded-[22px] border border-[#DDE8E4] bg-[#F7FAF9] p-4 text-left shadow-sm transition hover:border-[#20C7A4]/60 hover:bg-white"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#15483F]">
              <Dumbbell className="h-7 w-7" />
            </span>
            <ChevronRight className="h-5 w-5 text-[#6B7773] transition group-hover:translate-x-0.5 group-hover:text-[#20C7A4]" />
          </span>
          <span className="mt-5 block text-lg font-black text-[#17201E]">Quick workout</span>
          <span className="mt-1 block text-sm leading-5 text-[#6B7773]">
            Pick one exercise, set reps or timer, then start.
          </span>
        </Link>

        <Link
          href="/hub/workout/programs"
          className="group min-h-[164px] rounded-[22px] border border-[#DDE8E4] bg-[#F7FAF9] p-4 text-left shadow-sm transition hover:border-[#20C7A4]/60 hover:bg-white"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FFF4D7] text-[#8B5B00]">
              <ListChecks className="h-7 w-7" />
            </span>
            <ChevronRight className="h-5 w-5 text-[#6B7773] transition group-hover:translate-x-0.5 group-hover:text-[#20C7A4]" />
          </span>
          <span className="mt-5 block text-lg font-black text-[#17201E]">Program workout</span>
          <span className="mt-1 block text-sm leading-5 text-[#6B7773]">
            Follow a guided plan with fixed targets and automatic breaks.
          </span>
        </Link>
      </section>

      <section className="rounded-[22px] border border-[#DDE8E4] bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Workout log</p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={startBlankLog}
            disabled={startingLog}
            className="flex min-h-12 items-center justify-between rounded-[16px] bg-[#F7FAF9] px-4 text-sm font-bold text-[#17201E]"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#20C7A4]" />
              {startingLog ? "Starting..." : "Blank strength log"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#6B7773]" />
          </button>
          <Link
            href="/hub/workout/history"
            className="flex min-h-12 items-center justify-between rounded-[16px] bg-[#F7FAF9] px-4 text-sm font-bold text-[#17201E]"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#20C7A4]" />
              History
            </span>
            <ChevronRight className="h-4 w-4 text-[#6B7773]" />
          </Link>
          <Link
            href="/hub/workout/templates"
            className="flex min-h-12 items-center justify-between rounded-[16px] bg-[#F7FAF9] px-4 text-sm font-bold text-[#17201E]"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#20C7A4]" />
              Saved templates
            </span>
            <ChevronRight className="h-4 w-4 text-[#6B7773]" />
          </Link>
        </div>
      </section>
    </div>
  );
}
