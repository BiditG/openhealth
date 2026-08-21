"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Leaf,
  Loader2,
  Moon,
  Pause,
  Play,
  Settings,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Landmark = {
  x: number;
  y: number;
  visibility?: number;
};

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Landmark[][] };
  close?: () => void;
};

type MeditationCategory =
  | "Calm"
  | "Focus"
  | "Sleep"
  | "Breathing"
  | "Stress"
  | "Mindfulness"
  | "Body awareness"
  | "Short sessions"
  | "Beginner"
  | "Advanced"
  | "Camera-assisted";

type BreathPhase = "inhale" | "hold" | "exhale" | "pause";
type BreathPatternKey = "relaxed" | "equal" | "box" | "fourSevenEight" | "custom";

type BreathingPattern = {
  label: string;
  phases: Array<{
    phase: BreathPhase;
    label: string;
    seconds: number;
    scale: number;
  }>;
};

type MeditationSession = {
  id: string;
  title: string;
  subtitle: string;
  durationSec: number;
  categories: MeditationCategory[];
  pattern?: BreathingPattern;
  guidance: string[];
  recommended?: boolean;
};

type CameraChoice = "coach" | "audio" | "timer";
type CameraAppearance = "hidden" | "soft" | "full";
type MeditationPhase = "home" | "choice" | "setup" | "intro" | "session" | "paused" | "complete";
type MusicTrack = {
  label: string;
  src: string;
};

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MEDITATION_AUDIO_BASE = "/meditationaudio";
const MEDITATION_CUES = {
  introduction: `${MEDITATION_AUDIO_BASE}/introduction.wav`,
  breathIn: `${MEDITATION_AUDIO_BASE}/breathin.wav`,
  breathOut: `${MEDITATION_AUDIO_BASE}/breathout.wav`,
  breathInAgain: `${MEDITATION_AUDIO_BASE}/breathinagain.wav`,
  breathOutAgain: `${MEDITATION_AUDIO_BASE}/breathoutagain.wav`,
  conclusion: `${MEDITATION_AUDIO_BASE}/conclusion.wav`,
};
const MEDITATION_MUSIC: MusicTrack[] = [
  {
    label: "Deep Stillness",
    src: `${MEDITATION_AUDIO_BASE}/Meditationbackgroundmusic/Deep Stillness.mp3`,
  },
  {
    label: "Sacred Breath",
    src: `${MEDITATION_AUDIO_BASE}/Meditationbackgroundmusic/Sacred Breath.mp3`,
  },
  {
    label: "Sacred Stillness",
    src: `${MEDITATION_AUDIO_BASE}/Meditationbackgroundmusic/Sacred Stillness.mp3`,
  },
  {
    label: "Sacred Stillness 2",
    src: `${MEDITATION_AUDIO_BASE}/Meditationbackgroundmusic/Sacred Stillness (1).mp3`,
  },
];
const MUSIC_NORMAL_VOLUME = 0.34;
const MUSIC_DUCKED_VOLUME = 0.1;

const BREATH_PATTERNS: Record<Exclude<BreathPatternKey, "custom">, BreathingPattern> = {
  relaxed: {
    label: "Relaxed breathing",
    phases: [
      { phase: "inhale", label: "Breathe in", seconds: 4, scale: 1.18 },
      { phase: "exhale", label: "Breathe out", seconds: 6, scale: 0.82 },
    ],
  },
  equal: {
    label: "Equal breathing",
    phases: [
      { phase: "inhale", label: "Breathe in", seconds: 5, scale: 1.16 },
      { phase: "exhale", label: "Breathe out", seconds: 5, scale: 0.82 },
    ],
  },
  box: {
    label: "Box breathing",
    phases: [
      { phase: "inhale", label: "Breathe in", seconds: 4, scale: 1.16 },
      { phase: "hold", label: "Hold", seconds: 4, scale: 1.16 },
      { phase: "exhale", label: "Breathe out", seconds: 4, scale: 0.82 },
      { phase: "pause", label: "Pause", seconds: 4, scale: 0.82 },
    ],
  },
  fourSevenEight: {
    label: "4-7-8 breathing",
    phases: [
      { phase: "inhale", label: "Breathe in", seconds: 4, scale: 1.18 },
      { phase: "hold", label: "Hold", seconds: 7, scale: 1.18 },
      { phase: "exhale", label: "Breathe out", seconds: 8, scale: 0.78 },
    ],
  },
};

const BREATH_PATTERN_OPTIONS: Array<{ key: BreathPatternKey; label: string; detail: string }> = [
  { key: "relaxed", label: "Relaxed", detail: "4 in • 6 out" },
  { key: "equal", label: "Equal", detail: "5 in • 5 out" },
  { key: "box", label: "Box", detail: "4 • 4 • 4 • 4" },
  { key: "fourSevenEight", label: "4-7-8", detail: "4 • 7 • 8" },
  { key: "custom", label: "Custom", detail: "Your pace" },
];

const SESSIONS: MeditationSession[] = [
  {
    id: "quick-calm",
    title: "Quick Calm",
    subtitle: "2 min reset",
    durationSec: 120,
    categories: ["Calm", "Short sessions", "Beginner"],
    pattern: BREATH_PATTERNS.relaxed,
    recommended: true,
    guidance: ["Settle into your seat.", "Relax your shoulders.", "Let the next breath be easy."],
  },
  {
    id: "five-calm",
    title: "5-Minute Calm",
    subtitle: "Breathing + posture",
    durationSec: 300,
    categories: ["Calm", "Breathing", "Camera-assisted"],
    pattern: BREATH_PATTERNS.relaxed,
    recommended: true,
    guidance: ["Notice your breath.", "Let your jaw soften.", "Return to the rhythm."],
  },
  {
    id: "ten-meditation",
    title: "10-Minute Meditation",
    subtitle: "Mindful attention",
    durationSec: 600,
    categories: ["Mindfulness", "Beginner"],
    pattern: BREATH_PATTERNS.relaxed,
    guidance: ["Notice thoughts without chasing them.", "Come back to breathing.", "Stay gentle."],
  },
  {
    id: "deep-calm",
    title: "20-Minute Deep Calm",
    subtitle: "Longer practice",
    durationSec: 1200,
    categories: ["Calm", "Advanced"],
    pattern: BREATH_PATTERNS.equal,
    guidance: ["Allow stillness.", "Soften your body.", "Rest your attention here."],
  },
  {
    id: "morning-reset",
    title: "Morning Reset",
    subtitle: "Start clear",
    durationSec: 420,
    categories: ["Focus", "Mindfulness"],
    pattern: BREATH_PATTERNS.relaxed,
    guidance: ["Sit tall.", "Feel your body wake up.", "Choose one intention."],
  },
  {
    id: "stress-relief",
    title: "Stress Relief",
    subtitle: "Guided release",
    durationSec: 480,
    categories: ["Stress", "Calm", "Camera-assisted"],
    pattern: BREATH_PATTERNS.fourSevenEight,
    recommended: true,
    guidance: ["Unclench your hands.", "Let your shoulders drop.", "Give yourself room."],
  },
  {
    id: "focus",
    title: "Focus Meditation",
    subtitle: "Attention practice",
    durationSec: 600,
    categories: ["Focus", "Mindfulness"],
    pattern: BREATH_PATTERNS.box,
    guidance: ["Pick one anchor.", "Return without frustration.", "Steady and clear."],
  },
  {
    id: "sleep",
    title: "Sleep Wind-Down",
    subtitle: "Relaxation",
    durationSec: 900,
    categories: ["Sleep", "Calm"],
    pattern: BREATH_PATTERNS.fourSevenEight,
    recommended: true,
    guidance: ["Let the day end.", "Release the forehead.", "Exhale slowly."],
  },
  {
    id: "body-scan",
    title: "Body Scan",
    subtitle: "Body awareness",
    durationSec: 720,
    categories: ["Body awareness", "Mindfulness"],
    guidance: ["Notice your feet.", "Relax the belly.", "Let each area soften."],
  },
  {
    id: "silent",
    title: "Silent Meditation",
    subtitle: "Quiet timer",
    durationSec: 600,
    categories: ["Mindfulness", "Advanced"],
    guidance: ["Begin when ready.", "Stay with yourself.", "Close gently."],
  },
  {
    id: "box",
    title: "Box Breathing",
    subtitle: "4-4-4-4 rhythm",
    durationSec: 300,
    categories: ["Breathing", "Focus", "Beginner"],
    pattern: BREATH_PATTERNS.box,
    guidance: ["Follow the square rhythm.", "Keep the breath soft.", "Stay steady."],
  },
  {
    id: "four-seven-eight",
    title: "4-7-8 Breathing",
    subtitle: "Sleep + stress",
    durationSec: 300,
    categories: ["Breathing", "Sleep", "Stress"],
    pattern: BREATH_PATTERNS.fourSevenEight,
    guidance: ["Inhale quietly.", "Hold without strain.", "Exhale longer."],
  },
  {
    id: "custom",
    title: "Custom Session",
    subtitle: "Your pace",
    durationSec: 600,
    categories: ["Mindfulness", "Camera-assisted"],
    pattern: BREATH_PATTERNS.equal,
    guidance: ["Choose comfort.", "Stay kind.", "Return softly."],
  },
];

const EXPLORE_CATEGORIES: MeditationCategory[] = [
  "Calm",
  "Focus",
  "Sleep",
  "Breathing",
  "Stress",
  "Body awareness",
];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function clampSeconds(value: number, min = 0, max = 20) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getPatternKey(pattern?: BreathingPattern): Exclude<BreathPatternKey, "custom"> {
  const match = Object.entries(BREATH_PATTERNS).find(([, value]) => value === pattern);
  return (match?.[0] as Exclude<BreathPatternKey, "custom"> | undefined) ?? "relaxed";
}

function visibility(point?: Landmark) {
  return point?.visibility ?? 0;
}

function getCameraStatus(landmarks?: Landmark[]) {
  if (!landmarks) return "Looking for you...";
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const upperBodyConfidence =
    (visibility(nose) + visibility(leftShoulder) + visibility(rightShoulder)) / 3;
  const torsoConfidence = (visibility(leftHip) + visibility(rightHip)) / 2;

  if (upperBodyConfidence < 0.35) return "Looking for you...";
  if ((leftShoulder?.y ?? 0.5) < 0.18 || (rightShoulder?.y ?? 0.5) < 0.18) {
    return "Move slightly back";
  }
  if (torsoConfidence < 0.25) return "Raise the camera a little";
  if (upperBodyConfidence > 0.65) return "Good position";
  return "Upper body detected";
}

async function loadPoseLandmarker(): Promise<PoseLandmarkerLike> {
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string
  ) => Promise<{
    FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
    PoseLandmarker: {
      createFromOptions: (
        vision: unknown,
        options: Record<string, unknown>
      ) => Promise<PoseLandmarkerLike>;
    };
  }>;

  const visionTasks = await dynamicImport(TASKS_VISION_URL);
  const vision = await visionTasks.FilesetResolver.forVisionTasks(WASM_URL);
  return visionTasks.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  });
}

export function MeditationMode() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const playedBreathCueCountRef = useRef(0);
  const conclusionPlayedRef = useRef(false);
  const introCueTimeoutRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<MeditationPhase>("home");
  const [selectedSession, setSelectedSession] = useState<MeditationSession | null>(null);
  const [cameraChoice, setCameraChoice] = useState<CameraChoice>("coach");
  const [cameraAppearance, setCameraAppearance] = useState<CameraAppearance>("soft");
  const [cameraStatus, setCameraStatus] = useState("Looking for you...");
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [patternKey, setPatternKey] = useState<BreathPatternKey>("relaxed");
  const [customInhale, setCustomInhale] = useState(4);
  const [customHold, setCustomHold] = useState(0);
  const [customExhale, setCustomExhale] = useState(6);
  const [customPause, setCustomPause] = useState(0);
  const [breathController, setBreathController] = useState({
    phaseIndex: 0,
    remaining: BREATH_PATTERNS.relaxed.phases[0].seconds,
  });
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [selectedMusic, setSelectedMusic] = useState(MEDITATION_MUSIC[0]?.src ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const [lastSession, setLastSession] = useState<MeditationSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recommended = SESSIONS.filter((session) => session.recommended);
  const customPattern = useMemo<BreathingPattern>(() => {
    const phases: BreathingPattern["phases"] = [
      { phase: "inhale", label: "Breathe in", seconds: Math.max(1, customInhale), scale: 1.18 },
    ];
    if (customHold > 0) {
      phases.push({ phase: "hold", label: "Hold", seconds: customHold, scale: 1.18 });
    }
    phases.push({ phase: "exhale", label: "Breathe out", seconds: Math.max(1, customExhale), scale: 0.82 });
    if (customPause > 0) {
      phases.push({ phase: "pause", label: "Pause", seconds: customPause, scale: 0.82 });
    }
    return { label: "Custom breathing", phases };
  }, [customExhale, customHold, customInhale, customPause]);
  const activePattern = patternKey === "custom" ? customPattern : BREATH_PATTERNS[patternKey];
  const breathStep =
    activePattern.phases[breathController.phaseIndex % activePattern.phases.length] ??
    activePattern.phases[0];
  const breathCount = Math.max(1, breathController.remaining);
  const breathTransitionSeconds = Math.max(1, breathStep.seconds);
  const orbTone = {
    inhale: "border-primary/30 bg-primary/10 shadow-[0_0_90px_rgba(20,184,166,0.30)]",
    hold: "border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_76px_rgba(16,185,129,0.24)]",
    exhale: "border-sky-400/30 bg-sky-400/10 shadow-[0_0_70px_rgba(56,189,248,0.22)]",
    pause: "border-slate-300 bg-secondary shadow-[0_0_52px_rgba(15,23,42,0.12)]",
  }[breathStep.phase];
  const canStartFromSetup = cameraChoice !== "coach" || cameraStatus === "Good position" || cameraStatus === "Upper body detected";

  const stopLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  const setMusicVolume = useCallback((volume: number) => {
    const music = musicAudioRef.current;
    if (!music) return;
    music.volume = volume;
  }, []);

  const playCue = useCallback((src: string, options?: { onEnded?: () => void; stopMusicAfter?: boolean }) => {
    if (typeof window === "undefined") return;
    const audio = cueAudioRef.current ?? new Audio();
    cueAudioRef.current = audio;
    audio.pause();
    audio.currentTime = 0;
    audio.src = encodeURI(src);
    audio.volume = 0.92;
    setMusicVolume(MUSIC_DUCKED_VOLUME);
    audio.onended = () => {
      if (options?.stopMusicAfter) {
        musicAudioRef.current?.pause();
      } else {
        setMusicVolume(MUSIC_NORMAL_VOLUME);
      }
      options?.onEnded?.();
    };
    void audio.play().catch(() => {
      setMusicVolume(MUSIC_NORMAL_VOLUME);
      options?.onEnded?.();
    });
  }, [setMusicVolume]);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      const result = landmarker.detectForVideo(video, performance.now());
      setCameraStatus(getCameraStatus(result.landmarks?.[0]));
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(detectLoop);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }
      if (!landmarkerRef.current) {
        landmarkerRef.current = await loadPoseLandmarker();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stopLoop();
      animationRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start camera coach.");
      setCameraChoice("audio");
    }
  }, [detectLoop, stopLoop]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [phase, cameraAppearance]);

  const openChoice = (session: MeditationSession) => {
    const nextPatternKey = getPatternKey(session.pattern);
    setSelectedSession(session);
    setPatternKey(nextPatternKey);
    setBreathController({
      phaseIndex: 0,
      remaining: BREATH_PATTERNS[nextPatternKey].phases[0].seconds,
    });
    setCameraChoice("coach");
    setPhase("choice");
  };

  const beginSetup = async (choice: CameraChoice) => {
    if (!selectedSession) return;
    setCameraChoice(choice);
    setRemaining(selectedSession.durationSec);
    setElapsed(0);
    setBreathController({
      phaseIndex: 0,
      remaining: activePattern.phases[0]?.seconds ?? 1,
    });
    if (choice === "coach") {
      setPhase("setup");
      await startCamera();
      return;
    }
    stopCamera();
    setPhase("setup");
  };

  const startSession = () => {
    if (!selectedSession) return;
    setRemaining(selectedSession.durationSec);
    setElapsed(0);
    playedBreathCueCountRef.current = 0;
    conclusionPlayedRef.current = false;
    setBreathController({
      phaseIndex: 0,
      remaining: activePattern.phases[0]?.seconds ?? 1,
    });
    if (introCueTimeoutRef.current) {
      window.clearTimeout(introCueTimeoutRef.current);
      introCueTimeoutRef.current = null;
    }
    setPhase("intro");
    playCue(MEDITATION_CUES.introduction, {
      onEnded: () => {
        setRemaining(selectedSession.durationSec);
        setElapsed(0);
        setBreathController({
          phaseIndex: 0,
          remaining: activePattern.phases[0]?.seconds ?? 1,
        });
        setPhase("session");
        introCueTimeoutRef.current = window.setTimeout(() => {
          playedBreathCueCountRef.current = 1;
          playCue(MEDITATION_CUES.breathIn);
        }, 250);
      },
    });
  };

  const playBreathCueForPhase = useCallback((phaseName: BreathPhase) => {
    if (playedBreathCueCountRef.current >= 4) return;
    if (phaseName === "inhale" && playedBreathCueCountRef.current === 0) {
      playedBreathCueCountRef.current = 1;
      playCue(MEDITATION_CUES.breathIn);
      return;
    }
    if (phaseName === "exhale" && playedBreathCueCountRef.current === 1) {
      playedBreathCueCountRef.current = 2;
      playCue(MEDITATION_CUES.breathOut);
      return;
    }
    if (phaseName === "inhale" && playedBreathCueCountRef.current === 2) {
      playedBreathCueCountRef.current = 3;
      playCue(MEDITATION_CUES.breathInAgain);
      return;
    }
    if (phaseName === "exhale" && playedBreathCueCountRef.current === 3) {
      playedBreathCueCountRef.current = 4;
      playCue(MEDITATION_CUES.breathOutAgain);
    }
  }, [playCue]);

  useEffect(() => {
    if (phase !== "session") return;
    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          setPhase("complete");
          if (selectedSession) setLastSession(selectedSession);
          return 0;
        }
        return value - 1;
      });
      setElapsed((value) => value + 1);
      setBreathController((controller) => {
        if (controller.remaining > 1) {
          return { ...controller, remaining: controller.remaining - 1 };
        }
        const nextPhaseIndex = (controller.phaseIndex + 1) % activePattern.phases.length;
        playBreathCueForPhase(activePattern.phases[nextPhaseIndex]?.phase ?? "inhale");
        return {
          phaseIndex: nextPhaseIndex,
          remaining: activePattern.phases[nextPhaseIndex]?.seconds ?? 1,
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activePattern, phase, playBreathCueForPhase, selectedSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const music = musicAudioRef.current ?? new Audio();
    musicAudioRef.current = music;
    if ((phase !== "intro" && phase !== "session") || !musicEnabled || !selectedMusic) {
      music.pause();
      return;
    }
    if (!music.src.endsWith(encodeURI(selectedMusic))) {
      music.src = encodeURI(selectedMusic);
    }
    music.loop = true;
    music.volume = phase === "intro" ? MUSIC_DUCKED_VOLUME : MUSIC_NORMAL_VOLUME;
    void music.play().catch(() => undefined);
    return () => {
      if (phase !== "intro" && phase !== "session") music.pause();
    };
  }, [musicEnabled, phase, selectedMusic]);

  useEffect(() => {
    if (phase === "complete" && !conclusionPlayedRef.current) {
      conclusionPlayedRef.current = true;
      playCue(MEDITATION_CUES.conclusion, { stopMusicAfter: true });
    }
  }, [phase, playCue]);

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close?.();
      cueAudioRef.current?.pause();
      musicAudioRef.current?.pause();
      if (introCueTimeoutRef.current) {
        window.clearTimeout(introCueTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  const sessionInstruction = useMemo(() => {
    if (!selectedSession) return "Take a few minutes for yourself.";
    if (cameraChoice === "coach" && cameraStatus !== "Good position" && cameraStatus !== "Upper body detected") {
      return cameraStatus;
    }
    const index = Math.floor(elapsed / 45) % selectedSession.guidance.length;
    return selectedSession.guidance[index] ?? "Return to your breath.";
  }, [cameraChoice, cameraStatus, elapsed, selectedSession]);

  const breathingControls = (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Breathing pattern</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BREATH_PATTERN_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setPatternKey(option.key);
                const nextPattern = option.key === "custom" ? customPattern : BREATH_PATTERNS[option.key];
                setBreathController({
                  phaseIndex: 0,
                  remaining: nextPattern.phases[0]?.seconds ?? 1,
                });
              }}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left text-sm transition",
                patternKey === option.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-foreground"
              )}
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Background music</p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => setMusicEnabled((enabled) => !enabled)}
            className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-white px-4 text-sm font-semibold"
          >
            <span>Play calm music</span>
            <span className={cn("rounded-full px-3 py-1 text-xs", musicEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {musicEnabled ? "On" : "Off"}
            </span>
          </button>
          <select
            value={selectedMusic}
            onChange={(event) => {
              setSelectedMusic(event.target.value);
              setMusicEnabled(true);
            }}
            className="h-12 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none focus:border-primary"
          >
            {MEDITATION_MUSIC.map((track) => (
              <option key={track.src} value={track.src}>
                {track.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn("rounded-2xl border border-border p-4", patternKey !== "custom" && "opacity-60")}>
        <p className="text-sm font-semibold text-foreground">Custom timing</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["Inhale", customInhale, setCustomInhale, 1],
            ["Hold", customHold, setCustomHold, 0],
            ["Exhale", customExhale, setCustomExhale, 1],
            ["Pause", customPause, setCustomPause, 0],
          ].map(([label, value, setter, min]) => (
            <label key={String(label)} className="text-xs font-semibold text-muted-foreground">
              {String(label)}
              <input
                type="number"
                min={Number(min)}
                max={20}
                value={Number(value)}
                onFocus={() => setPatternKey("custom")}
                onChange={(event) => {
                  setPatternKey("custom");
                  (setter as (value: number) => void)(
                    clampSeconds(Number(event.target.value), Number(min), 20)
                  );
                }}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  if (phase === "home") {
    return (
      <div className="space-y-6 pb-8">
        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          <p className="text-sm font-semibold text-primary">Meditation</p>
          <h2 className="mt-1 text-3xl font-semibold text-foreground">Take a few minutes for yourself.</h2>
          {lastSession && (
            <button
              type="button"
              onClick={() => openChoice(lastSession)}
              className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border bg-secondary px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">Continue last session</span>
                <span className="text-xs text-muted-foreground">{lastSession.title}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recommended</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recommended.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => openChoice(session)}
                className="w-[190px] shrink-0 rounded-[22px] border border-border bg-white p-4 text-left shadow-sm dark:bg-card"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Leaf className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">{session.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(session.durationSec / 60)} min
                </p>
                <p className="mt-2 text-xs font-medium text-primary">{session.subtitle}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Quick start</h3>
          <div className="grid grid-cols-4 gap-2">
            {[2, 5, 10, 15].map((mins) => {
              const session = SESSIONS.find((item) => Math.round(item.durationSec / 60) === mins) ?? SESSIONS[0];
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => openChoice({ ...session, durationSec: mins * 60, title: `${mins} min` })}
                  className="min-h-16 rounded-[20px] border border-border bg-white text-sm font-semibold shadow-sm dark:bg-card"
                >
                  {mins} min
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Explore</h3>
          <div className="grid grid-cols-2 gap-2">
            {EXPLORE_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  const session = SESSIONS.find((item) => item.categories.includes(category)) ?? SESSIONS[0];
                  openChoice(session);
                }}
                className="flex min-h-14 items-center justify-between rounded-[20px] border border-border bg-white px-4 text-left text-sm font-semibold shadow-sm dark:bg-card"
              >
                {category}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (phase === "choice" && selectedSession) {
    return (
      <div className="space-y-4 pb-8">
        <button type="button" onClick={() => setPhase("home")} className="text-sm font-semibold text-primary">
          Back
        </button>
        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          <h2 className="text-2xl font-semibold text-foreground">{selectedSession.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatTime(selectedSession.durationSec)} • {selectedSession.subtitle}
          </p>
        </section>
        {[
          ["coach", "Camera Coach", "Optional posture and stillness guidance.", Camera],
          ["audio", "Audio Only", "Same session without camera.", Volume2],
          ["timer", "Silent Timer", "Simple timer with breathing visuals.", Clock],
        ].map(([choice, title, description, Icon]) => (
          <button
            key={String(choice)}
            type="button"
            onClick={() => void beginSetup(choice as CameraChoice)}
            className="flex w-full items-center gap-4 rounded-[22px] border border-border bg-white p-4 text-left shadow-sm dark:bg-card"
          >
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            <span>
              <span className="block text-sm font-semibold">{String(title)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{String(description)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  if ((phase === "setup" || phase === "paused") && selectedSession) {
    return (
      <div className="space-y-4 pb-8">
        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          <h2 className="text-2xl font-semibold text-foreground">Get comfortable</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>Sit in a comfortable position.</li>
            <li>Keep your head and upper body visible.</li>
            <li>Place the phone somewhere stable.</li>
            <li>Relax your shoulders. You can close your eyes after starting.</li>
          </ul>
        </section>

        {cameraChoice === "coach" && (
          <section className="overflow-hidden rounded-[24px] border border-border bg-black">
            <div className="relative aspect-[4/5] max-h-[560px]">
              <video
                ref={videoRef}
                className={cn(
                  "h-full w-full scale-x-[-1] object-cover",
                  cameraAppearance === "hidden" && "opacity-0",
                  cameraAppearance === "soft" && "blur-[2px] brightness-75"
                )}
                muted
                playsInline
              />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/92 p-4 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-semibold text-foreground">{cameraStatus}</p>
                {canStartFromSetup && (
                  <p className="mt-1 text-xs text-primary">You are ready</p>
                )}
              </div>
            </div>
          </section>
        )}

        {error && <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          {breathingControls}
        </section>

        <button
          type="button"
          onClick={startSession}
          disabled={!canStartFromSetup}
          className="min-h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
        >
          Start meditation
        </button>
      </div>
    );
  }

  if ((phase === "intro" || phase === "session" || phase === "complete") && selectedSession) {
    const progress = selectedSession.durationSec > 0 ? (elapsed / selectedSession.durationSec) * 100 : 0;
    return (
      <div className="space-y-5 pb-8">
        <section className="relative overflow-hidden rounded-[28px] border border-border bg-white p-6 text-center shadow-sm dark:bg-card">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white"
          >
            <Settings className="h-4 w-4" />
          </button>

          {cameraChoice === "coach" && cameraAppearance !== "hidden" && (
            <video
              ref={videoRef}
              className={cn(
                "absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-20",
                cameraAppearance === "soft" && "blur-[3px] brightness-75",
                cameraAppearance === "full" && "opacity-35"
              )}
              muted
              playsInline
            />
          )}

          <div className="relative z-10">
            <p className="text-sm font-semibold text-primary">{selectedSession.title}</p>
            <div
              className={cn(
                "relative mx-auto mt-8 flex h-60 w-60 items-center justify-center rounded-full border transition-[transform,background-color,box-shadow,border-color,filter] ease-in-out",
                orbTone
              )}
              style={{
                transform: `scale(${breathStep.scale})`,
                transitionDuration: `${breathTransitionSeconds}s`,
                background:
                  breathStep.phase === "inhale"
                    ? "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.95), rgba(94,234,212,0.55) 30%, rgba(56,189,248,0.34) 58%, rgba(20,184,166,0.18) 100%)"
                    : "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.88), rgba(186,230,253,0.48) 32%, rgba(20,184,166,0.26) 62%, rgba(15,118,110,0.12) 100%)",
                filter: breathStep.phase === "inhale" ? "saturate(1.15)" : "saturate(0.95)",
              }}
            >
              <div className="absolute -inset-6 rounded-full border border-primary/10 animate-pulse" />
              <div className="absolute inset-3 rounded-full border border-white/70 shadow-inner" />
              <div className="absolute inset-8 rounded-full border border-primary/15" />
              <div className="absolute left-10 top-9 h-16 w-20 rounded-full bg-white/55 blur-xl" />
              <div
                className="absolute h-24 w-24 rounded-full bg-white/70 blur-2xl transition-opacity"
                style={{ opacity: breathStep.phase === "inhale" ? 0.92 : 0.58 }}
              />
              <div className="relative text-center">
                <p className="text-lg font-semibold text-foreground">
                  {phase === "intro" ? "Settle in" : breathStep.label}
                </p>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-primary">
                  {phase === "intro" ? "..." : breathCount}
                </p>
              </div>
            </div>
            <p className="mt-8 text-4xl font-semibold tabular-nums text-foreground">{formatTime(remaining)}</p>
            <p className="mt-5 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
              {phase === "intro"
                ? "Listen to the introduction. Your timer will start after it finishes."
                : phase === "complete"
                  ? "Session complete"
                  : sessionInstruction}
            </p>
            {cameraChoice === "coach" && (
              <p className="mt-3 text-xs font-medium text-primary">{cameraStatus}</p>
            )}
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            {phase === "complete" ? (
              <button
                type="button"
                onClick={() => setPhase("home")}
                className="mt-6 min-h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (introCueTimeoutRef.current) {
                    window.clearTimeout(introCueTimeoutRef.current);
                    introCueTimeoutRef.current = null;
                  }
                  cueAudioRef.current?.pause();
                  musicAudioRef.current?.pause();
                  setPhase("paused");
                }}
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-semibold"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
            )}
          </div>
        </section>

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3">
            <div className="w-full rounded-[24px] bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Meditation settings</p>
                <button type="button" onClick={() => setShowSettings(false)} className="rounded-full p-2 hover:bg-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {(["hidden", "soft", "full"] as CameraAppearance[]).map((appearance) => (
                  <button
                    key={appearance}
                    type="button"
                    onClick={() => setCameraAppearance(appearance)}
                    className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-sm font-semibold"
                  >
                    <span className="flex items-center gap-3">
                      {appearance === "hidden" ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-primary" />}
                      {appearance === "hidden" ? "Hidden" : appearance === "soft" ? "Soft Preview" : "Full Preview"}
                    </span>
                    {cameraAppearance === appearance && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-border pt-5">
                {breathingControls}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
