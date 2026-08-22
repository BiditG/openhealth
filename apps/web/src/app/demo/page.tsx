"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Camera, CheckCircle2, Dumbbell, Loader2, Play, RotateCcw, Utensils, Video } from "lucide-react";
import { ProPlans } from "@/components/pro/pro-plans";
import { cn } from "@/lib/utils";

const DEMO_STORAGE_KEY = "swastha.pending.demo";

type DemoUsage = {
  foodUsed: boolean;
  curlUsed: boolean;
};

function readUsage(): DemoUsage {
  if (typeof window === "undefined") return { foodUsed: false, curlUsed: false };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY) ?? "{}") as Partial<DemoUsage>;
    return { foodUsed: Boolean(parsed.foodUsed), curlUsed: Boolean(parsed.curlUsed) };
  } catch {
    return { foodUsed: false, curlUsed: false };
  }
}

function writeUsage(next: DemoUsage) {
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
}

export default function DemoPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [usage, setUsage] = useState<DemoUsage>({ foodUsed: false, curlUsed: false });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [foodStage, setFoodStage] = useState<"idle" | "reading" | "result">("idle");
  const [foodResult, setFoodResult] = useState<{ name: string; calories: number; protein: number } | null>(null);
  const [curlStage, setCurlStage] = useState<"idle" | "camera" | "running" | "complete">("idle");
  const [curlReps, setCurlReps] = useState(0);
  const youtubeId = process.env.NEXT_PUBLIC_DEMO_YOUTUBE_ID;

  useEffect(() => {
    setUsage(readUsage());
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (curlStage !== "running") return;
    if (curlReps >= 5) {
      const next = { ...usage, curlUsed: true };
      setUsage(next);
      writeUsage(next);
      setCurlStage("complete");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => setCurlReps((value) => value + 1), 900);
    return () => window.clearTimeout(timer);
  }, [curlReps, curlStage, usage]);

  const handleFoodFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || usage.foodUsed) return;
    setFoodStage("reading");

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result);
      const calories = 320 + Math.min(260, Math.round(file.size / 24000));
      setImagePreview(preview);
      setFoodResult({
        name: file.name.split(".")[0]?.replace(/[-_]/g, " ").slice(0, 34) || "Demo meal",
        calories,
        protein: Math.max(8, Math.round(calories / 45)),
      });
      const next = { ...usage, foodUsed: true };
      setUsage(next);
      writeUsage(next);
      setFoodStage("result");
    };
    reader.onerror = () => setFoodStage("idle");
    reader.readAsDataURL(file);
  };

  const startCurlDemo = async () => {
    if (usage.curlUsed) return;
    setCurlReps(0);
    setCurlStage("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCurlStage("running");
    } catch {
      setCurlStage("running");
    }
  };

  const resetLocalDemo = () => {
    const next = { foodUsed: false, curlUsed: false };
    setUsage(next);
    writeUsage(next);
    setImagePreview(null);
    setFoodResult(null);
    setFoodStage("idle");
    setCurlReps(0);
    setCurlStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  return (
    <main className="min-h-screen bg-[#F7FAF9] px-4 py-6">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/pending-activation" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E3EAE7] bg-white px-4 text-sm font-bold text-[#123F37]">
            <ArrowLeft className="h-4 w-4" />
            Activation
          </Link>
          <button
            type="button"
            onClick={resetLocalDemo}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E3EAE7] bg-white px-4 text-sm font-bold text-[#6B7773]"
          >
            <RotateCcw className="h-4 w-4" />
            Reset local demo
          </button>
        </div>

        <div className="overflow-hidden rounded-[28px] bg-[#123F37] p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Limited waiting demo</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-normal">Try a small taste of Swastha while your account is being activated.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            This demo is intentionally limited: one food photo preview, one bicep curl demo, and your intro video.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-[24px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#EAF8F4] text-[#123F37]">
                <Utensils className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-[#17201E]">Food snap demo</h2>
                <p className="text-sm text-[#6B7773]">One photo, demo calories only.</p>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoodFile} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={usage.foodUsed}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123F37] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {foodStage === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {usage.foodUsed ? "Demo snap used" : "Take one food snap"}
            </button>

            {imagePreview && (
              <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[18px] bg-[#F7FAF9]">
                <Image src={imagePreview} alt="Demo food preview" fill className="object-cover" />
              </div>
            )}

            {foodResult && (
              <div className="mt-4 rounded-[18px] bg-[#EAF8F4] p-4">
                <p className="text-sm font-black text-[#17201E]">{foodResult.name}</p>
                <p className="mt-2 text-3xl font-black text-[#123F37]">{foodResult.calories} kcal</p>
                <p className="mt-1 text-sm text-[#6B7773]">Demo protein estimate: {foodResult.protein} g. Full Pro saves this into your diary.</p>
              </div>
            )}
          </article>

          <article className="rounded-[24px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#EAF8F4] text-[#123F37]">
                <Dumbbell className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-[#17201E]">Bicep curl demo</h2>
                <p className="text-sm text-[#6B7773]">A short preview of rep counting.</p>
              </div>
            </div>

            <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-[18px] bg-neutral-950">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover opacity-70" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <p className="text-7xl font-black tabular-nums">{curlReps}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.2em]">demo reps</p>
              </div>
              <div
                className={cn(
                  "absolute bottom-5 left-1/2 h-20 w-2 origin-bottom -translate-x-1/2 rounded-full bg-[#20C7A4] transition-transform duration-500",
                  curlStage === "running" && curlReps % 2 === 1 ? "rotate-[-48deg]" : "rotate-[38deg]"
                )}
              />
            </div>

            <button
              type="button"
              onClick={startCurlDemo}
              disabled={usage.curlUsed || curlStage === "running" || curlStage === "camera"}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123F37] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {curlStage === "camera" ? <Loader2 className="h-4 w-4 animate-spin" /> : curlStage === "complete" ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {usage.curlUsed ? "Demo curl used" : "Start bicep demo"}
            </button>
          </article>

          <article className="rounded-[24px] border border-[#E3EAE7] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#EAF8F4] text-[#123F37]">
                <Video className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-[#17201E]">Intro video</h2>
                <p className="text-sm text-[#6B7773]">Ready for the YouTube upload.</p>
              </div>
            </div>

            <div className="mt-5 aspect-video overflow-hidden rounded-[18px] bg-[#123F37]">
              {youtubeId ? (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title="Swastha demo video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
                  <Video className="h-10 w-10 text-[#20C7A4]" />
                  <p className="mt-4 text-lg font-black">Video coming soon</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Add `NEXT_PUBLIC_DEMO_YOUTUBE_ID` after uploading your YouTube video.
                  </p>
                </div>
              )}
            </div>
          </article>
        </div>

        <ProPlans compact />
      </section>
    </main>
  );
}
