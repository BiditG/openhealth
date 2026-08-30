"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { WorkoutAnalyzerMode } from "../../food/scan-label/workout-analyzer-mode";

export default function QuickWorkoutPage() {
  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/hub/workout"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DDE8E4] bg-white text-[#15483F] shadow-sm"
          aria-label="Back to workouts"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-[#20C7A4]" />
            <h1 className="truncate text-[24px] font-black leading-tight text-[#17201E]">Quick workout</h1>
          </div>
          <p className="mt-1 text-sm leading-5 text-[#6B7773]">
            Choose one exercise, set the reps or timer, and train immediately.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-[22px] bg-muted" />
            <div className="h-44 animate-pulse rounded-[22px] bg-muted" />
          </div>
        }
      >
        <WorkoutAnalyzerMode experience="quick" />
      </Suspense>
    </div>
  );
}
