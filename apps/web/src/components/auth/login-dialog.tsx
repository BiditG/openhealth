"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Crown,
  HeartPulse,
  Mail,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { signIn, signUp } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

const registrationSteps = ["name", "team", "goals", "followups", "activity", "basics", "body", "account"] as const;

type GoalFocus = "body_building" | "weight_reduction" | "general_health";
type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active";
type TeamColor = "red" | "blue";
type GoalId =
  | "weight_loss"
  | "maintain_weight"
  | "healthy_weight_gain"
  | "eat_better"
  | "build_muscle"
  | "move_more"
  | "improve_energy";

const goalOptions: Array<{
  id: GoalId;
  label: string;
  description: string;
  category: "weight" | "wellness";
}> = [
  { id: "weight_loss", label: "Lose weight", description: "A steady, realistic weight cut.", category: "weight" },
  { id: "maintain_weight", label: "Maintain weight", description: "Stay near your current weight.", category: "weight" },
  { id: "healthy_weight_gain", label: "Gain weight", description: "Add weight in a planned way.", category: "weight" },
  { id: "eat_better", label: "Eat better", description: "Improve meals without overthinking.", category: "wellness" },
  { id: "build_muscle", label: "Build muscle", description: "Support training and recovery.", category: "wellness" },
  { id: "move_more", label: "Move more", description: "Build a more active routine.", category: "wellness" },
  { id: "improve_energy", label: "Feel energetic", description: "Reduce sluggish days and crashes.", category: "wellness" },
];

const activityOptions: Array<{ id: ActivityLevel; label: string; example: string }> = [
  { id: "sedentary", label: "Less active", example: "Mostly sitting, short walks only." },
  { id: "lightly_active", label: "Lightly active", example: "Walks or light chores most days." },
  { id: "moderately_active", label: "Active", example: "Exercise or longer walks 3-5 days a week." },
  { id: "very_active", label: "Very active", example: "Hard training, active job, or sports most days." },
  { id: "extremely_active", label: "Athlete level", example: "Intense training plus a highly active day." },
];

const teamOptions: Record<
  TeamColor,
  {
    name: string;
    statement: string;
    traits: string;
    description: string;
    accentClass: string;
    selectedClass: string;
    badgeClass: string;
  }
> = {
  blue: {
    name: "Blue",
    statement: "I let my game speak.",
    traits: "Calm • Precise • Unshaken",
    description: "For people who let results do the talking.",
    accentClass: "bg-blue-600 text-white",
    selectedClass: "border-blue-500 bg-blue-50 shadow-[0_12px_28px_rgba(96,165,250,0.18)]",
    badgeClass: "bg-blue-600 text-white",
  },
  red: {
    name: "Red",
    statement: "I came to dominate.",
    traits: "Fearless • Driven • Relentless",
    description: "For people who want the top spot.",
    accentClass: "bg-red-600 text-white",
    selectedClass: "border-red-500 bg-red-50 shadow-[0_12px_28px_rgba(248,113,113,0.18)]",
    badgeClass: "bg-red-600 text-white",
  },
};

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function getPrimaryGoal(selectedGoals: GoalId[]): GoalFocus {
  if (selectedGoals.includes("weight_loss")) return "weight_reduction";
  if (selectedGoals.includes("build_muscle") || selectedGoals.includes("healthy_weight_gain")) return "body_building";
  return "general_health";
}

function getGoalType(selectedGoals: GoalId[]) {
  if (selectedGoals.includes("weight_loss")) return "lose";
  if (selectedGoals.includes("healthy_weight_gain")) return "gain";
  return "maintain";
}

function getHeightCm(heightCm: string, heightFt: string) {
  const cm = Number(heightCm);
  if (Number.isFinite(cm) && cm > 0) return Number(cm.toFixed(1));
  const ft = Number(heightFt);
  if (Number.isFinite(ft) && ft > 0) return Number((ft * 30.48).toFixed(1));
  return null;
}

function estimateCalories({
  weightKg,
  heightCm,
  dateOfBirth,
  sex,
  activityLevel,
  primaryGoal,
}: {
  weightKg: number | null;
  heightCm: number | null;
  dateOfBirth: string;
  sex: "male" | "female" | "other" | "";
  activityLevel: ActivityLevel;
  primaryGoal: GoalFocus;
}) {
  const weight = weightKg ?? 70;
  const height = heightCm ?? 170;
  const birthYear = dateOfBirth ? new Date(dateOfBirth).getFullYear() : NaN;
  const age = Number.isFinite(birthYear) ? new Date().getFullYear() - birthYear : 30;
  const sexOffset = sex === "female" ? -161 : 5;
  const multiplier =
    activityLevel === "sedentary"
      ? 1.2
      : activityLevel === "lightly_active"
        ? 1.375
        : activityLevel === "very_active"
          ? 1.725
          : activityLevel === "extremely_active"
            ? 1.9
            : 1.55;
  const maintenance = (10 * weight + 6.25 * height - 5 * age + sexOffset) * multiplier;
  const adjusted =
    primaryGoal === "weight_reduction"
      ? maintenance - 350
      : primaryGoal === "body_building"
        ? maintenance + 200
        : maintenance;
  return Math.max(1200, Math.round(adjusted / 50) * 50);
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [teamColor, setTeamColor] = useState<TeamColor>("blue");
  const [selectedGoals, setSelectedGoals] = useState<GoalId[]>(["weight_loss"]);
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>({});
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderately_active");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const completeOnboarding = trpc.user.completeOnboarding.useMutation();
  const { data: teamScores } = trpc.tasks.getTeamScores.useQuery(undefined, {
    enabled: mode === "register" && open,
    staleTime: 30_000,
  });

  const primaryGoal = useMemo(() => getPrimaryGoal(selectedGoals), [selectedGoals]);
  const weightGoal = selectedGoals.find((goal) => goalOptions.find((option) => option.id === goal)?.category === "weight");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setReferralCode("");
    setRegisterStep(0);
    setFullName("");
    setTeamColor("blue");
    setSelectedGoals(["weight_loss"]);
    setGoalNotes({});
    setBirthDate("");
    setCountry("");
    setSex("");
    setHeightCm("");
    setHeightFt("");
    setWeightKg("");
    setTargetWeightKg("");
    setActivityLevel("moderately_active");
    setDietaryPreference("");
    setMedicalConditions("");
    setError("");
    setLoading(false);
  };

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const toggleGoal = (goal: GoalId) => {
    setError("");
    setSelectedGoals((current) => {
      const option = goalOptions.find((item) => item.id === goal);
      const isSelected = current.includes(goal);
      if (isSelected) return current.filter((item) => item !== goal);
      const withoutExistingWeight =
        option?.category === "weight"
          ? current.filter((item) => goalOptions.find((goalOption) => goalOption.id === item)?.category !== "weight")
          : current;
      if (withoutExistingWeight.length >= 3) return withoutExistingWeight;
      return [...withoutExistingWeight, goal];
    });
  };

  const validateRegistrationStep = () => {
    const step = registrationSteps[registerStep];

    if (step === "name" && fullName.trim().length < 2) return "Enter your full name.";
    if (step === "goals") {
      if (selectedGoals.length === 0) return "Choose at least one goal.";
      if (selectedGoals.length > 3) return "Choose up to 3 goals.";
      if (!weightGoal) return "Choose one weight goal.";
    }
    if (step === "basics") {
      if (!sex) return "Choose your gender.";
      if (!birthDate) return "Enter your birth date.";
      if (!country.trim()) return "Enter your country.";
    }
    if (step === "body") {
      const weight = Number(weightKg);
      const height = getHeightCm(heightCm, heightFt);
      const target = Number(targetWeightKg);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return "Enter your current weight in kg.";
      if (!height || height < 40 || height > 300) return "Enter your height in cm or feet.";
      if (targetWeightKg && (!Number.isFinite(target) || target <= 0 || target > 500)) return "Enter a valid weight goal in kg, or leave it blank.";
    }
    if (step === "account") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
      if (password.length < 8) return t("auth.passwordMinLength");
    }

    return "";
  };

  const handleRegisterNext = () => {
    const validationError = validateRegistrationStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setRegisterStep((currentStep) => Math.min(currentStep + 1, registrationSteps.length - 1));
  };

  const handleRegisterBack = () => {
    setError("");
    setRegisterStep((currentStep) => Math.max(currentStep - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        setLoading(true);
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || "Sign in failed. Check your email and password.");
          setLoading(false);
          return;
        }
        if (!result.data?.session) {
          setError("Sign in could not create a session. Please confirm your email, then try again.");
          setLoading(false);
          return;
        }
        posthog.capture("user_logged_in", { method: "email" });
      } else {
        const validationError = validateRegistrationStep();
        if (validationError) {
          setError(validationError);
          return;
        }
        setLoading(true);
        const height = getHeightCm(heightCm, heightFt);
        const currentWeight = weightKg ? Number(weightKg) : null;
        const targetWeight = targetWeightKg ? Number(targetWeightKg) : null;
        const calorieTarget = estimateCalories({
          weightKg: currentWeight,
          heightCm: height,
          dateOfBirth: birthDate,
          sex,
          activityLevel,
          primaryGoal,
        });
        const profile = {
          name: fullName.trim(),
          sex: sex || null,
          heightCm: height,
          currentWeightKg: currentWeight,
          dateOfBirth: birthDate || null,
          activityLevel,
          medicalConditions: parseList(medicalConditions),
          medications: null,
          allergies: null,
          dietaryPreference: dietaryPreference || null,
          primaryGoal,
          teamColor,
          onboardingCompleted: true,
        };
        const result = await signUp.email({
          name: fullName.trim(),
          email: email.trim(),
          password,
          metadata: {
            onboarding_profile: profile,
            selected_goals: selectedGoals,
            goal_notes: goalNotes,
            country: country.trim(),
            team_color: teamColor,
            target_weight_kg: targetWeight,
          },
        });
        if (result.error) {
          setError(result.error.message || t("auth.registerFailed"));
          setLoading(false);
          return;
        }
        if (!result.data?.session) {
          setError("Registration saved. Please confirm your email if a verification link was sent, then sign in.");
          setLoading(false);
          return;
        }

        if (result.data?.user) {
          try {
            await completeOnboarding.mutateAsync({
              profile,
              goals: {
                goalType: getGoalType(selectedGoals),
                targetWeightKg: targetWeight,
                weeklyRateKg: weightGoal === "weight_loss" ? 0.4 : weightGoal === "healthy_weight_gain" ? 0.25 : null,
                calorieTarget,
                proteinG: null,
                carbsG: null,
                fatG: null,
                fiberG: null,
              },
            });
          } catch {
            setError("Account created. Please complete health details from Profile.");
            setLoading(false);
            return;
          }
        }
        posthog.capture("user_signed_up", { method: "email", selected_goals: selectedGoals });

        if (referralCode.trim()) {
          try {
            const { applyReferralCode } = await import("@/server/actions/referral");
            const referralResult = await applyReferralCode({ code: referralCode.trim() });
            if (!referralResult.success) {
              setError(t("auth.registerSuccessReferralFailedWithError", { error: referralResult.error }));
              setLoading(false);
              setReferralCode("");
              return;
            }
          } catch {
            setError(t("auth.registerSuccessReferralFailed"));
            setLoading(false);
            setReferralCode("");
            return;
          }
        }
      }

      resetForm();
      onOpenChange(false);
      if (onSuccess) onSuccess();
      else router.refresh();
    } catch {
      setError(mode === "login" ? t("auth.loginFailedRetry") : t("auth.registerFailedRetry"));
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setRegisterStep(0);
  };

  const renderRegistrationStep = () => {
    const step = registrationSteps[registerStep];
    const stepNumber = registerStep + 1;
    const totalSteps = registrationSteps.length;

    return (
      <div className="rounded-[22px] border border-[#35D39A]/20 bg-[#0B2C24] p-4 sm:p-5">
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase text-[#6B7773]">
            <span>Step {stepNumber} of {totalSteps}</span>
            <span>{Math.round((stepNumber / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#07251E]">
            <div className="h-full rounded-full bg-[#B8F34A] transition-all" style={{ width: `${(stepNumber / totalSteps) * 100}%` }} />
          </div>
        </div>

        {step === "name" && (
          <div className="space-y-4">
            <StepIntro icon={User} title="What should we call you?" description="We are happy you are here. Let us make FitNMove feel personal from the first screen." />
            <Input id="register-name" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </div>
        )}

        {step === "team" && (
          <div className="space-y-4">
            <StepIntro icon={Shield} title="Choose your team" description="Pick the color that matches how you compete. Every point you earn joins your team score." />
            <div className="grid gap-3 sm:grid-cols-2">
              {(["blue", "red"] as const).map((team) => {
                const option = teamOptions[team];
                const score = teamScores?.teams.find((item) => item.teamColor === team);
                const selected = teamColor === team;
                const isLeader = teamScores?.leaderTeam === team;
                const needsYou = teamScores?.needsYouTeam === team;
                return (
                  <button
                    key={team}
                    type="button"
                    onClick={() => setTeamColor(team)}
                    className={`relative overflow-hidden rounded-[18px] border p-4 text-left transition-all ${
                      selected ? option.selectedClass : "border-[#E3EAE7] bg-white hover:border-[#20C7A4]"
                    }`}
                  >
                    {isLeader && (
                      <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Crown className="h-4 w-4 fill-amber-400" />
                      </span>
                    )}
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${option.accentClass}`}
                    >
                      <Shield className="h-6 w-6" />
                    </span>
                    <span className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-[#6B7773]">
                      Team {option.name}
                    </span>
                    <span className="mt-2 block text-xl font-black leading-6 text-[#17201E]">
                      {option.statement}
                    </span>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${option.badgeClass}`}>
                      {option.traits}
                    </span>
                    <span className="mt-3 block text-sm font-semibold leading-5 text-[#17201E]">
                      {option.description}
                    </span>
                    <span className="mt-3 block text-xs font-semibold text-[#6B7773]">
                      {Number(score?.points ?? 0).toLocaleString()} pts • {Number(score?.members ?? 0)} members
                    </span>
                    <span
                      className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        needsYou
                          ? team === "red"
                            ? "bg-red-600 text-white"
                            : "bg-blue-600 text-white"
                          : "bg-white text-[#6B7773]"
                      }`}
                    >
                      {needsYou ? "Needs you more" : isLeader ? "In the lead" : "Ready for points"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "goals" && (
          <div className="space-y-4">
            <StepIntro icon={Target} title="Now for your goals." description="Select up to 3 that are important to you, including one weight goal." />
            <div className="grid gap-2">
              {goalOptions.map((goal) => {
                const selected = selectedGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    className={`grid min-h-[74px] grid-cols-[1fr_auto] items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition-all ${
                      selected ? "border-[#20C7A4] bg-white shadow-[0_8px_24px_rgba(15,168,139,0.14)]" : "border-[#E3EAE7] bg-white/70 hover:border-[#20C7A4]"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-[#17201E]">{goal.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[#6B7773]">{goal.description}</span>
                    </span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${selected ? "border-[#20C7A4] bg-[#20C7A4] text-white" : "border-[#E3EAE7] text-transparent"}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "followups" && (
          <div className="space-y-4">
            <StepIntro icon={Sparkles} title="A little context helps." description="Answer what matters. Short notes are enough." />
            <div className="space-y-3">
              {selectedGoals.map((goal) => {
                const option = goalOptions.find((item) => item.id === goal);
                return (
                  <div key={goal} className="rounded-[16px] border border-[#E1E9E5] bg-white p-3">
                    <label className="text-sm font-bold text-[#17201E]" htmlFor={`goal-note-${goal}`}>
                      {option?.label}: what would progress look like?
                    </label>
                    <Textarea
                      id={`goal-note-${goal}`}
                      className="mt-2 min-h-[74px]"
                      placeholder="Example: fit better in clothes, avoid late snacks, train 3 days a week..."
                      value={goalNotes[goal] ?? ""}
                      onChange={(e) => setGoalNotes((current) => ({ ...current, [goal]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "activity" && (
          <div className="space-y-4">
            <StepIntro icon={Activity} title="What is your baseline activity?" description="Pick the option that looks most like a normal week for you." />
            <div className="space-y-2">
              {activityOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActivityLevel(option.id)}
                  className={`w-full rounded-[16px] border px-4 py-3 text-left transition-all ${
                    activityLevel === option.id ? "border-[#20C7A4] bg-white shadow-[0_8px_24px_rgba(15,168,139,0.14)]" : "border-[#E3EAE7] bg-white/70 hover:border-[#20C7A4]"
                  }`}
                >
                  <span className="block text-sm font-bold text-[#17201E]">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#6B7773]">{option.example}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "basics" && (
          <div className="space-y-4">
            <StepIntro icon={CalendarDays} title="Your basics" description="This helps FitNMove set a realistic daily guide." />
            <div className="grid grid-cols-3 gap-2">
              {[
                ["male", "Male"],
                ["female", "Female"],
                ["other", "Other"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSex(value as typeof sex)}
                  className={`min-h-[48px] rounded-[14px] border px-3 text-sm font-bold transition-colors ${
                    sex === value ? "border-[#20C7A4] bg-[#20C7A4] text-white" : "border-[#E3EAE7] bg-white text-[#17201E]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7773]" />
              <Input className="pl-11" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" />
            </div>
          </div>
        )}

        {step === "body" && (
          <div className="space-y-4">
            <StepIntro icon={Scale} title="Weight, height, and goal" description="Your target weight is optional. You can change it later." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current weight">
                <Input type="number" inputMode="decimal" step="0.1" placeholder="63.0 kg" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} min={1} max={500} />
              </Field>
              <Field label="Weight goal">
                <Input type="number" inputMode="decimal" step="0.1" placeholder="58 kg optional" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} min={1} max={500} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height in cm">
                <Input type="number" inputMode="decimal" step="0.1" placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} min={40} max={300} />
              </Field>
              <Field label="or feet">
                <Input type="number" inputMode="decimal" step="0.1" placeholder="5.8" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} min={1} max={9} />
              </Field>
            </div>
            {weightKg && targetWeightKg && (
              <div className="rounded-[16px] bg-[#EAF8F4] p-4 text-sm font-bold text-[#15483F]">
                {Number(weightKg).toFixed(1)} kg to {Number(targetWeightKg).toFixed(1)} kg. FitNMove will make the daily guide easier to read from this.
              </div>
            )}
          </div>
        )}

        {step === "account" && (
          <div className="space-y-4">
            <StepIntro icon={Mail} title="Create your account" description="One last step, then your hub will open with your weight goal first." />
            <Input type="email" placeholder={t("auth.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Input type="password" placeholder={t("auth.passwordRegisterPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            <Textarea placeholder="Health notes, allergies, or conditions. Optional." value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} />
            <Input placeholder="Diet preference. Optional, e.g. vegetarian" value={dietaryPreference} onChange={(e) => setDietaryPreference(e.target.value)} />
            <Input placeholder={t("auth.referralCodePlaceholder")} value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} maxLength={12} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={handleRegisterBack} disabled={registerStep === 0 || loading}>
            Back
          </Button>
          {registerStep < registrationSteps.length - 1 ? (
            <Button type="button" onClick={handleRegisterNext} disabled={loading}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? t("auth.registering") : "Finish registration"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogHeader>
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#B8F34A] text-[#041A15]">
          <HeartPulse className="h-6 w-6" />
        </div>
        <DialogTitle className="text-center text-primary">
          {mode === "login" ? t("auth.loginToContinue") : "Set up FitNMove"}
        </DialogTitle>
        <DialogDescription className="text-center">
          {mode === "login" ? t("auth.loginDescription") : "A short, friendly setup so your hub tells you what the numbers mean."}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {error && <div className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</div>}

        {mode === "login" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading || appleLoading || loading}
              onClick={async () => {
                setGoogleLoading(true);
                setError("");
                try {
                  await signIn.social({ provider: "google" });
                  posthog.capture("user_logged_in", { method: "google" });
                } catch {
                  setError(t("auth.googleLoginFailed"));
                  setGoogleLoading(false);
                }
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? t("auth.loggingIn") : t("auth.useGoogleLogin")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading || appleLoading || loading}
              onClick={async () => {
                setAppleLoading(true);
                setError("");
                try {
                  await signIn.social({ provider: "apple" });
                  posthog.capture("user_logged_in", { method: "apple" });
                } catch {
                  setError(t("auth.appleLoginFailed"));
                  setAppleLoading(false);
                }
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {appleLoading ? t("auth.loggingIn") : t("auth.useAppleLogin")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t("auth.or")}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "register" ? (
          renderRegistrationStep()
        ) : (
          <>
            <Input type="email" placeholder={t("auth.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Input type="password" placeholder={t("auth.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.loggingIn") : t("auth.login")}
            </Button>
          </>
        )}
      </form>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
        <button type="button" onClick={switchMode} className="font-semibold text-primary hover:underline">
          {mode === "login" ? t("auth.register") : t("auth.login")}
        </button>
      </p>
    </Dialog>
  );
}

function StepIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#20C7A4] shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-lg font-bold leading-6 text-[#17201E]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#6B7773]">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase text-[#6B7773]">{label}</span>
      {children}
    </label>
  );
}
