"use client";

import { create } from "zustand";
import { useEffect, useRef } from "react";

interface ActivityTimerState {
  elapsedSeconds: number;
  isRunning: boolean;
  sessionId: string | null;
  sessionType: "exercise" | "meditation" | null;

  // Countdown (for meditation timer mode)
  countdown: { remaining: number; total: number } | null;

  // Actions
  startSession: (
    sessionId: string,
    type: "exercise" | "meditation",
    startedAt: Date
  ) => void;
  stopSession: () => void;
  tick: () => void;
  startCountdown: (seconds: number) => void;
  cancelCountdown: () => void;
  tickCountdown: () => void;
}

export const useActivityTimerStore = create<ActivityTimerState>((set) => ({
  elapsedSeconds: 0,
  isRunning: false,
  sessionId: null,
  sessionType: null,
  countdown: null,

  startSession: (sessionId, type, startedAt) =>
    set({
      sessionId,
      sessionType: type,
      isRunning: true,
      elapsedSeconds: Math.floor(
        (Date.now() - startedAt.getTime()) / 1000
      ),
    }),

  stopSession: () =>
    set({
      sessionId: null,
      sessionType: null,
      isRunning: false,
      elapsedSeconds: 0,
      countdown: null,
    }),

  tick: () =>
    set((state) => ({
      elapsedSeconds: state.isRunning
        ? state.elapsedSeconds + 1
        : state.elapsedSeconds,
    })),

  startCountdown: (seconds) =>
    set({ countdown: { remaining: seconds, total: seconds } }),

  cancelCountdown: () => set({ countdown: null }),

  tickCountdown: () =>
    set((state) => {
      if (!state.countdown) return state;
      const remaining = state.countdown.remaining - 1;
      if (remaining <= 0) {
        return { countdown: { ...state.countdown, remaining: 0 } };
      }
      return {
        countdown: { ...state.countdown, remaining },
      };
    }),
}));

/** Hook that runs the timer interval */
export function useActivityTimerTick() {
  const isRunning = useActivityTimerStore((s) => s.isRunning);
  const countdown = useActivityTimerStore((s) => s.countdown);
  const tick = useActivityTimerStore((s) => s.tick);
  const tickCountdown = useActivityTimerStore((s) => s.tickCountdown);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (isRunning || countdown) {
      intervalRef.current = setInterval(() => {
        if (isRunning) tick();
        if (countdown && countdown.remaining > 0) tickCountdown();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, countdown, tick, tickCountdown]);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}
