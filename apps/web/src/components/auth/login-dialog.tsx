"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { signIn, signUp } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

const registrationSteps = [
  "email",
  "password",
  "gender",
  "age",
  "height",
  "weight",
  "goal",
  "complications",
] as const;

type GoalFocus = "body_building" | "weight_reduction" | "general_health";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [heightFt, setHeightFt] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderately_active");
  const [primaryGoal, setPrimaryGoal] = useState<GoalFocus>("general_health");
  const [calorieTarget, setCalorieTarget] = useState("2050");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const completeOnboarding = trpc.user.completeOnboarding.useMutation();

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setReferralCode("");
    setRegisterStep(0);
    setAge("");
    setSex("");
    setHeightFt("");
    setWeightKg("");
    setActivityLevel("moderately_active");
    setPrimaryGoal("general_health");
    setCalorieTarget("2050");
    setDietaryPreference("");
    setMedicalConditions("");
    setMedications("");
    setAllergies("");
    setError("");
    setLoading(false);
  };

  const getDateOfBirthFromAge = () => {
    const years = Number(age);
    if (!Number.isFinite(years) || years <= 0) return null;
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - years);
    return dob.toISOString().slice(0, 10);
  };

  const getNameFromEmail = () => email.trim().split("@")[0] || "User";

  const getHeightCmFromFeet = () => {
    const feet = Number(heightFt);
    if (!Number.isFinite(feet) || feet <= 0) return null;
    return Number((feet * 30.48).toFixed(1));
  };

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const validateRegistrationStep = () => {
    const step = registrationSteps[registerStep];

    if (step === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Enter a valid email address.";
    }
    if (step === "password" && password.length < 8) {
      return t("auth.passwordMinLength");
    }
    if (step === "gender" && !sex) {
      return "Choose your gender.";
    }
    if (step === "age") {
      const years = Number(age);
      if (!Number.isInteger(years) || years < 1 || years > 120) {
        return "Enter an age between 1 and 120.";
      }
    }
    if (step === "height") {
      const feet = Number(heightFt);
      if (!Number.isFinite(feet) || feet < 1 || feet > 9) {
        return "Enter your height in feet, for example 5.8.";
      }
    }
    if (step === "weight") {
      const weight = Number(weightKg);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
        return "Enter your weight in kg.";
      }
    }
    if (step === "goal" && !primaryGoal) {
      return "Choose your primary goal.";
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
        const name = getNameFromEmail();
        const profile = {
          name,
          sex: sex || null,
          heightCm: getHeightCmFromFeet(),
          currentWeightKg: weightKg ? Number(weightKg) : null,
          dateOfBirth: getDateOfBirthFromAge(),
          activityLevel: activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active",
          medicalConditions: parseList(medicalConditions),
          medications: medications || null,
          allergies: allergies || null,
          dietaryPreference: dietaryPreference || null,
          primaryGoal,
          onboardingCompleted: true,
        };
        const result = await signUp.email({
          name,
          email: email.trim(),
          password,
          metadata: {
            onboarding_profile: profile,
            primary_goal: primaryGoal,
            medical_conditions: profile.medicalConditions,
          },
        });
        if (result.error) {
          setError(result.error.message || t("auth.registerFailed"));
          setLoading(false);
          return;
        }
        if (!result.data?.session) {
          setError("Registration saved. Please confirm your email if Supabase sent a verification link, then sign in.");
          setLoading(false);
          return;
        }

        if (result.data?.user) {
          try {
            await completeOnboarding.mutateAsync({
              profile,
              goals: {
                calorieTarget: calorieTarget ? Number(calorieTarget) : null,
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
        posthog.capture("user_signed_up", { method: "email" });

        // Apply referral code after successful registration
        if (referralCode.trim()) {
          try {
            const { applyReferralCode } = await import("@/server/actions/referral");
            const referralResult = await applyReferralCode({ code: referralCode.trim() });
            if (!referralResult.success) {
              // Registration succeeded but referral failed — show error and keep dialog open
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
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
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
      <div className="space-y-4 rounded-2xl border border-border bg-muted p-4">
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
            />
          </div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Step {stepNumber} of {totalSteps}
          </p>
        </div>

        {step === "email" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-email">
              What is your email?
            </label>
            <Input
              id="register-email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        )}

        {step === "password" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-password">
              Create a password
            </label>
            <Input
              id="register-password"
              type="password"
              placeholder={t("auth.passwordRegisterPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        )}

        {step === "gender" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">What is your gender?</p>
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
                  className={`min-h-[50px] rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    sex === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-white text-foreground hover:bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "age" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-age">
              How old are you?
            </label>
            <Input
              id="register-age"
              type="number"
              inputMode="numeric"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min={1}
              max={120}
              required
            />
          </div>
        )}

        {step === "height" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-height">
              What is your height in feet?
            </label>
            <Input
              id="register-height"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Example: 5.8"
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
              min={1}
              max={9}
              required
            />
          </div>
        )}

        {step === "weight" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-weight">
              What is your weight?
            </label>
            <Input
              id="register-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Weight kg"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              min={1}
              max={500}
              required
            />
          </div>
        )}

        {step === "goal" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">What is your primary goal?</p>
            <div className="space-y-2">
              {[
                ["body_building", "Body building"],
                ["weight_reduction", "Weight reduction"],
                ["general_health", "General health"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrimaryGoal(value as GoalFocus)}
                  className={`min-h-[50px] w-full rounded-xl border px-4 text-left text-sm font-semibold transition-colors ${
                    primaryGoal === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-white text-foreground hover:bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "complications" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="register-complications">
              Possible health complications
            </label>
            <Textarea
              id="register-complications"
              placeholder="Example: diabetes, hypertension, asthma. Leave blank if none."
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
            />
            <Input
              placeholder={t("auth.referralCodePlaceholder")}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              maxLength={12}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegisterBack}
            disabled={registerStep === 0 || loading}
          >
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
        <DialogTitle className="text-center text-primary">
          {mode === "login" ? t("auth.loginToContinue") : t("auth.createAccount")}
        </DialogTitle>
        <DialogDescription className="text-center">
          {mode === "login"
            ? t("auth.loginDescription")
            : t("auth.registerDescription")}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

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
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "register" ? (
          renderRegistrationStep()
        ) : (
          <>
            <Input
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.loggingIn") : t("auth.login")}
            </Button>
          </>
        )}
      </form>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
        <button
          type="button"
          onClick={switchMode}
          className="text-primary hover:underline"
        >
          {mode === "login" ? t("auth.register") : t("auth.login")}
        </button>
      </p>
    </Dialog>
  );
}
