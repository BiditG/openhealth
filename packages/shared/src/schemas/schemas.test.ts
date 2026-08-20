import { describe, it, expect } from "vitest";
import {
  logFoodSchema,
  createFoodSchema,
  updateFoodSchema,
  updateProfileSchema,
  updateGoalsSchema,
  logWeightSchema,
  logMeasurementsSchema,
  createFoodFromBarcodeSchema,
  copyMealSchema,
  removeEntrySchema,
  applyReferralCodeSchema,
  customizeReferralCodeSchema,
} from "./index";

const testUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("logFoodSchema", () => {
  const valid = {
    date: "2024-03-15",
    mealType: "breakfast" as const,
    foodId: testUuid,
    servingQty: 1.5,
  };

  it("accepts valid input", () => {
    expect(logFoodSchema.parse(valid)).toEqual(valid);
  });

  it("accepts with optional servingId", () => {
    expect(logFoodSchema.parse({ ...valid, servingId: testUuid })).toBeDefined();
  });

  it("rejects invalid date format", () => {
    expect(() => logFoodSchema.parse({ ...valid, date: "03/15/2024" })).toThrow();
    expect(() => logFoodSchema.parse({ ...valid, date: "2024-3-5" })).toThrow();
  });

  it("rejects invalid meal type", () => {
    expect(() => logFoodSchema.parse({ ...valid, mealType: "brunch" })).toThrow();
  });

  it("rejects non-positive serving qty", () => {
    expect(() => logFoodSchema.parse({ ...valid, servingQty: 0 })).toThrow();
    expect(() => logFoodSchema.parse({ ...valid, servingQty: -1 })).toThrow();
  });

  it("rejects non-UUID foodId", () => {
    expect(() => logFoodSchema.parse({ ...valid, foodId: "abc" })).toThrow();
  });
});

describe("createFoodSchema", () => {
  const valid = {
    name: "Chicken breast",
    servingSize: 100,
    servingUnit: "g",
    calories: 165,
  };

  it("accepts minimal valid input", () => {
    expect(createFoodSchema.parse(valid)).toEqual(valid);
  });

  it("accepts with optional fields", () => {
    expect(
      createFoodSchema.parse({
        ...valid,
        brand: "Test Brand",
        barcode: "1234567890",
        nutrients: [{ nutrientId: 1, amount: 31 }],
        alternateServings: [{ label: "1 slice", grams: 120 }],
      })
    ).toBeDefined();
  });

  it("rejects empty name", () => {
    expect(() => createFoodSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects negative calories", () => {
    expect(() => createFoodSchema.parse({ ...valid, calories: -1 })).toThrow();
  });

  it("accepts zero calories", () => {
    expect(createFoodSchema.parse({ ...valid, calories: 0 })).toBeDefined();
  });

  it("rejects non-positive serving size", () => {
    expect(() => createFoodSchema.parse({ ...valid, servingSize: 0 })).toThrow();
  });

  it("rejects negative nutrient amount", () => {
    expect(() =>
      createFoodSchema.parse({
        ...valid,
        nutrients: [{ nutrientId: 1, amount: -5 }],
      })
    ).toThrow();
  });
});

describe("updateFoodSchema", () => {
  it("requires id", () => {
    expect(() => updateFoodSchema.parse({ name: "test" })).toThrow();
  });

  it("accepts partial updates", () => {
    expect(updateFoodSchema.parse({ id: testUuid, name: "New name" })).toBeDefined();
    expect(updateFoodSchema.parse({ id: testUuid, calories: 200 })).toBeDefined();
  });

  it("allows nullish brand", () => {
    expect(updateFoodSchema.parse({ id: testUuid, brand: null })).toBeDefined();
    expect(updateFoodSchema.parse({ id: testUuid, brand: undefined })).toBeDefined();
  });
});

describe("updateProfileSchema", () => {
  const valid = {
    name: "Test user",
    sex: null,
    heightCm: null,
    dateOfBirth: null,
    activityLevel: null,
  };

  it("accepts valid input", () => {
    expect(updateProfileSchema.parse(valid)).toEqual(valid);
  });

  it("accepts all sex options", () => {
    for (const sex of ["male", "female", "other"]) {
      expect(updateProfileSchema.parse({ ...valid, sex })).toBeDefined();
    }
  });

  it("rejects height over 300", () => {
    expect(() => updateProfileSchema.parse({ ...valid, heightCm: 301 })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => updateProfileSchema.parse({ ...valid, name: "" })).toThrow();
  });
});

describe("updateGoalsSchema", () => {
  it("accepts all null (use defaults)", () => {
    expect(
      updateGoalsSchema.parse({
        calorieTarget: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
      })
    ).toBeDefined();
  });

  it("rejects calorie target over 20000", () => {
    expect(() =>
      updateGoalsSchema.parse({
        calorieTarget: 20001,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
      })
    ).toThrow();
  });

  it("rejects non-integer calorie target", () => {
    expect(() =>
      updateGoalsSchema.parse({
        calorieTarget: 1500.5,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
      })
    ).toThrow();
  });

  it("accepts zero macro values", () => {
    expect(
      updateGoalsSchema.parse({
        calorieTarget: null,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
      })
    ).toBeDefined();
  });

  it("rejects negative macro values", () => {
    expect(() =>
      updateGoalsSchema.parse({
        calorieTarget: null,
        proteinG: -1,
        carbsG: null,
        fatG: null,
        fiberG: null,
      })
    ).toThrow();
  });
});

describe("logWeightSchema", () => {
  it("accepts valid input", () => {
    expect(logWeightSchema.parse({ date: "2024-03-15", weightKg: 70 })).toBeDefined();
  });

  it("rejects weight over 500", () => {
    expect(() => logWeightSchema.parse({ date: "2024-03-15", weightKg: 501 })).toThrow();
  });

  it("rejects zero weight", () => {
    expect(() => logWeightSchema.parse({ date: "2024-03-15", weightKg: 0 })).toThrow();
  });
});

describe("logMeasurementsSchema", () => {
  it("accepts date only (all measurements optional)", () => {
    expect(logMeasurementsSchema.parse({ date: "2024-03-15" })).toBeDefined();
  });

  it("rejects body fat outside 0-100", () => {
    expect(() =>
      logMeasurementsSchema.parse({ date: "2024-03-15", bodyFatPct: 101 })
    ).toThrow();
    expect(() =>
      logMeasurementsSchema.parse({ date: "2024-03-15", bodyFatPct: -1 })
    ).toThrow();
  });

  it("accepts body fat at boundaries", () => {
    expect(logMeasurementsSchema.parse({ date: "2024-03-15", bodyFatPct: 0 })).toBeDefined();
    expect(logMeasurementsSchema.parse({ date: "2024-03-15", bodyFatPct: 100 })).toBeDefined();
  });
});

describe("createFoodFromBarcodeSchema", () => {
  const valid = {
    barcode: "4710088430204",
    name: "Tea drink",
    servingSize: 250,
    servingUnit: "ml",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  };

  it("accepts valid input", () => {
    expect(createFoodFromBarcodeSchema.parse(valid)).toEqual(valid);
  });

  it("rejects empty barcode", () => {
    expect(() => createFoodFromBarcodeSchema.parse({ ...valid, barcode: "" })).toThrow();
  });
});

describe("copyMealSchema", () => {
  it("accepts valid input", () => {
    expect(
      copyMealSchema.parse({
        fromDate: "2024-03-15",
        toDate: "2024-03-16",
        mealType: "lunch",
      })
    ).toBeDefined();
  });
});

describe("removeEntrySchema", () => {
  it("accepts valid UUID", () => {
    expect(removeEntrySchema.parse({ entryId: testUuid })).toBeDefined();
  });

  it("rejects non-UUID", () => {
    expect(() => removeEntrySchema.parse({ entryId: "not-a-testUuid" })).toThrow();
  });
});

describe("applyReferralCodeSchema", () => {
  it("accepts valid code", () => {
    expect(applyReferralCodeSchema.parse({ code: "ABCD1234" })).toBeDefined();
  });

  it("rejects too short (< 4 chars)", () => {
    expect(() => applyReferralCodeSchema.parse({ code: "AB" })).toThrow();
  });

  it("rejects too long (> 12 chars)", () => {
    expect(() => applyReferralCodeSchema.parse({ code: "ABCDEFGHIJKLM" })).toThrow();
  });

  it("rejects special characters", () => {
    expect(() => applyReferralCodeSchema.parse({ code: "AB-CD" })).toThrow();
    expect(() => applyReferralCodeSchema.parse({ code: "AB CD" })).toThrow();
  });

  it("accepts lowercase (regex is case-insensitive)", () => {
    expect(applyReferralCodeSchema.parse({ code: "abcd1234" })).toBeDefined();
  });
});

describe("customizeReferralCodeSchema", () => {
  it("has same rules as applyReferralCodeSchema", () => {
    expect(customizeReferralCodeSchema.parse({ code: "MYCODE" })).toBeDefined();
    expect(() => customizeReferralCodeSchema.parse({ code: "AB" })).toThrow();
  });
});
