"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, Footprints, Loader2, LogOut, Medal, Trophy, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { signOut, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import { updateProfile } from "@/server/actions/profile";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation(["settings", "common"]);
  const { data: session, isPending: sessionPending } = useSession();
  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery();
  const { data: achievementStats } = trpc.tasks.getMyStats.useQuery();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderately_active");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [localDistanceKm, setLocalDistanceKm] = useState(0);

  useEffect(() => {
    try {
      const activities = JSON.parse(window.localStorage.getItem("swastha.offline.activities") ?? "[]") as Array<{ distanceMeters?: number }>;
      const totalMeters = activities.reduce((sum, activity) => sum + (activity.distanceMeters ?? 0), 0);
      setLocalDistanceKm(totalMeters / 1000);
    } catch {
      setLocalDistanceKm(0);
    }
  }, []);

  useEffect(() => {
    if (!initialized && session?.user && profile !== undefined) {
      setName(session.user.name || "");
      setSex(profile?.sex || "");
      setHeightCm(profile?.heightCm ? String(profile.heightCm) : "");
      setCurrentWeightKg(profile?.currentWeightKg ? String(profile.currentWeightKg) : "");
      setDateOfBirth(profile?.dateOfBirth || "");
      setActivityLevel(profile?.activityLevel || "moderately_active");
      setPrimaryGoal(profile?.primaryGoal || "");
      setDietaryPreference(profile?.dietaryPreference || "");
      setMedicalConditions(profile?.medicalConditions?.join(", ") || "");
      setMedications(profile?.medications || "");
      setAllergies(profile?.allergies || "");
      setInitialized(true);
    }
  }, [session, profile, initialized]);

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSave = () => {
    setSaved(false);
    setError("");
    startTransition(async () => {
      const result = await updateProfile({
        name,
        sex: sex ? (sex as "male" | "female" | "other") : null,
        heightCm: heightCm ? Number(heightCm) : null,
        currentWeightKg: currentWeightKg ? Number(currentWeightKg) : null,
        dateOfBirth: dateOfBirth || null,
        activityLevel: activityLevel
          ? (activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active")
          : null,
        primaryGoal: primaryGoal || null,
        dietaryPreference: dietaryPreference || null,
        medicalConditions: parseList(medicalConditions),
        medications: medications || null,
        allergies: allergies || null,
        onboardingCompleted: true,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      posthog.capture("profile_updated");
      setSaved(true);
      router.refresh();
    });
  };

  const handleSignOut = async () => {
    posthog.capture("user_logged_out");
    posthog.reset();
    await signOut();
    router.push("/hub");
  };

  if (sessionPending || profileLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">Health profile</p>
          <h1 className="text-3xl font-semibold text-foreground">{t("profile")}</h1>
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activity achievements</h2>
            <p className="text-sm text-muted-foreground">Completed through Swastha tasks, missions, tracker, and analyzer.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Points", achievementStats?.points ?? 0, Trophy],
            ["Medals", achievementStats?.medals ?? 0, Medal],
            ["Tasks", achievementStats?.tasks ?? 0, Dumbbell],
            ["Missions", achievementStats?.missions ?? 0, Footprints],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl bg-secondary/70 p-4">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{Number(value)}</p>
              <p className="text-xs font-semibold text-muted-foreground">{String(label)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[
            ["Push-ups", achievementStats?.pushups ?? 0],
            ["Bicep curls", achievementStats?.bicepCurls ?? 0],
            ["Pull-ups", achievementStats?.pullups ?? 0],
            ["Squats", achievementStats?.squats ?? 0],
            ["Distance", `${localDistanceKm.toFixed(2)} km`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-white p-3 dark:bg-card">
              <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
              <p className="text-xs font-semibold text-muted-foreground">{String(label)}</p>
            </div>
          ))}
        </div>
        {achievementStats?.recentMedals?.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">Recent medals</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {achievementStats.recentMedals.map((medal) => (
                <div key={medal.id} className="rounded-2xl border border-border bg-secondary/40 p-3">
                  <p className="text-sm font-bold text-foreground">{medal.medalName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{medal.title} • {medal.medalPoints} pts</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <User className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("profilePage.basicInfo")}</h2>
            <p className="text-sm text-muted-foreground">Used to personalize your health experience.</p>
          </div>
        </div>
        <div className="space-y-5">
          <Field label={t("profilePage.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("profilePage.email")}>
            <Input defaultValue={session?.user?.email || ""} disabled />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <h2 className="text-lg font-semibold text-foreground">{t("profilePage.bodyInfo")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Only add what you want to use for estimates and goals.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label={t("profilePage.sex")}>
            <select
              className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-card"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">{t("profilePage.selectSex")}</option>
              <option value="male">{t("profilePage.male")}</option>
              <option value="female">{t("profilePage.female")}</option>
              <option value="other">{t("profilePage.other")}</option>
            </select>
          </Field>
          <Field label={t("profilePage.height")}>
            <Input type="number" placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </Field>
          <Field label="Current weight (kg)">
            <Input type="number" placeholder="65" value={currentWeightKg} onChange={(e) => setCurrentWeightKg(e.target.value)} />
          </Field>
          <Field label={t("profilePage.dateOfBirth")}>
            <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </Field>
          <Field label={t("profilePage.activityLevel")}>
            <select
              className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-card"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
            >
              <option value="sedentary">{t("profilePage.sedentary")}</option>
              <option value="lightly_active">{t("profilePage.lightlyActive")}</option>
              <option value="moderately_active">{t("profilePage.moderatelyActive")}</option>
              <option value="very_active">{t("profilePage.veryActive")}</option>
              <option value="extremely_active">{t("profilePage.extremelyActive")}</option>
            </select>
          </Field>
          <Field label="Primary goal">
            <select
              className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-card"
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
            >
              <option value="">Select goal</option>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain weight</option>
              <option value="gain">Gain muscle</option>
              <option value="manage_health">Manage health</option>
            </select>
          </Field>
          <Field label="Diet preference">
            <Input placeholder="Vegetarian, high protein, etc." value={dietaryPreference} onChange={(e) => setDietaryPreference(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <h2 className="text-lg font-semibold text-foreground">Health notes</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Used for safer coaching context. This is not a medical record.</p>
        <div className="mt-5 space-y-5">
          <Field label="Medical conditions">
            <Textarea placeholder="Diabetes, hypertension, thyroid, asthma..." value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} />
          </Field>
          <Field label="Medications">
            <Textarea placeholder="Optional" value={medications} onChange={(e) => setMedications(e.target.value)} />
          </Field>
          <Field label="Allergies">
            <Textarea placeholder="Peanuts, dairy, gluten..." value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </Field>
        </div>
      </section>

      {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <Button className="w-full" onClick={handleSave} disabled={isPending}>
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("profilePage.saving")}
          </span>
        ) : saved ? (
          t("profilePage.saved")
        ) : (
          t("common:buttons.save")
        )}
      </Button>

      <button
        onClick={handleSignOut}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        {t("profilePage.signOut")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
