import { describe, it, expect, vi } from "vitest";

// Mock DB modules before importing plan.ts
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/db/schema", () => ({ users: {}, aiUsage: {} }));
vi.mock("@/lib/date", () => ({ getNepalDate: () => "2024-01-01" }));
vi.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

import { resolveEffectivePlan, getAiLimit, canAccessFeature, requireFeature, ProRequiredError } from "./plan";

describe("resolveEffectivePlan", () => {
  const ONE_DAY_MS = 86_400_000;
  const now = new Date();
  const future = new Date(now.getTime() + ONE_DAY_MS);
  const past = new Date(now.getTime() - ONE_DAY_MS);

  it("returns pro when plan is pro and not expired", () => {
    expect(resolveEffectivePlan({ plan: "pro", planExpiresAt: future, trialExpiresAt: null })).toBe("pro");
  });

  it("returns pro when plan is pro with no expiry", () => {
    expect(resolveEffectivePlan({ plan: "pro", planExpiresAt: null, trialExpiresAt: null })).toBe("pro");
  });

  it("returns pro when pro plan expired but trial still active", () => {
    expect(resolveEffectivePlan({ plan: "pro", planExpiresAt: past, trialExpiresAt: future })).toBe("pro");
  });

  it("returns free when pro plan expired and no trial", () => {
    expect(resolveEffectivePlan({ plan: "pro", planExpiresAt: past, trialExpiresAt: null })).toBe("free");
  });

  it("returns free when pro plan expired and trial also expired", () => {
    expect(resolveEffectivePlan({ plan: "pro", planExpiresAt: past, trialExpiresAt: past })).toBe("free");
  });

  it("returns pro when free plan but trial is active", () => {
    expect(resolveEffectivePlan({ plan: "free", planExpiresAt: null, trialExpiresAt: future })).toBe("pro");
  });

  it("returns free when free plan and no trial", () => {
    expect(resolveEffectivePlan({ plan: "free", planExpiresAt: null, trialExpiresAt: null })).toBe("free");
  });

  it("returns free when free plan and trial expired", () => {
    expect(resolveEffectivePlan({ plan: "free", planExpiresAt: null, trialExpiresAt: past })).toBe("free");
  });
});

describe("getAiLimit", () => {
  it("returns finite limits for free plan", () => {
    expect(getAiLimit("free", "ocr")).toBe(3);
    expect(getAiLimit("free", "estimate")).toBe(3);
    expect(getAiLimit("free", "chat")).toBe(10);
  });

  it("returns Infinity for pro plan ocr/estimate", () => {
    expect(getAiLimit("pro", "ocr")).toBe(Infinity);
    expect(getAiLimit("pro", "estimate")).toBe(Infinity);
  });

  it("returns 100 for pro plan chat", () => {
    expect(getAiLimit("pro", "chat")).toBe(100);
  });
});

describe("canAccessFeature", () => {
  it("free plan cannot access premium features", () => {
    expect(canAccessFeature("free", "micronutrients")).toBe(false);
    expect(canAccessFeature("free", "exercise")).toBe(false);
    expect(canAccessFeature("free", "fasting")).toBe(false);
    expect(canAccessFeature("free", "progressPhotos")).toBe(false);
    expect(canAccessFeature("free", "exportData")).toBe(false);
  });

  it("pro plan can access all features", () => {
    expect(canAccessFeature("pro", "micronutrients")).toBe(true);
    expect(canAccessFeature("pro", "exercise")).toBe(true);
    expect(canAccessFeature("pro", "fasting")).toBe(true);
    expect(canAccessFeature("pro", "progressPhotos")).toBe(true);
    expect(canAccessFeature("pro", "exportData")).toBe(true);
  });

  it("free plan has ai object (truthy)", () => {
    expect(canAccessFeature("free", "ai")).toBe(true);
    expect(canAccessFeature("pro", "ai")).toBe(true);
  });
});

describe("requireFeature", () => {
  it("throws ProRequiredError for free plan gated features", () => {
    expect(() => requireFeature("free", "exercise")).toThrow(ProRequiredError);
  });

  it("includes feature name in error", () => {
    try {
      requireFeature("free", "exercise");
    } catch (e) {
      expect(e).toBeInstanceOf(ProRequiredError);
      expect((e as ProRequiredError).feature).toBe("exercise");
    }
  });

  it("does not throw for pro plan", () => {
    expect(() => requireFeature("pro", "exercise")).not.toThrow();
  });
});
