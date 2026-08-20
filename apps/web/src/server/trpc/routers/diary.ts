import { z } from "zod";
import { logFoodSchema, copyMealSchema, removeEntrySchema, updateEntryServingsSchema } from "@open-health/shared/schemas";
import { protectedProcedure, router } from "../trpc";
import { diaryEntries, foodNutrients, nutrientDefinitions } from "@/server/db/schema";
import { foods } from "@/server/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import * as diaryService from "@/server/services/diary";

export const diaryRouter = router({
  getDay: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db
        .select({
          id: diaryEntries.id,
          mealType: diaryEntries.mealType,
          servingQty: diaryEntries.servingQty,
          calories: diaryEntries.calories,
          proteinG: diaryEntries.proteinG,
          carbsG: diaryEntries.carbsG,
          fatG: diaryEntries.fatG,
          fiberG: diaryEntries.fiberG,
          sortOrder: diaryEntries.sortOrder,
          loggedAt: diaryEntries.loggedAt,
          foodId: diaryEntries.foodId,
          foodName: foods.name,
          foodBrand: foods.brand,
          foodServingSize: foods.servingSize,
          foodServingUnit: foods.servingUnit,
        })
        .from(diaryEntries)
        .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
        .where(
          and(
            eq(diaryEntries.userId, ctx.user.id),
            eq(diaryEntries.date, input.date)
          )
        )
        .orderBy(diaryEntries.mealType, diaryEntries.sortOrder);

      const totals = entries.reduce(
        (acc, entry) => ({
          calories: acc.calories + Number(entry.calories || 0),
          protein: acc.protein + Number(entry.proteinG || 0),
          carbs: acc.carbs + Number(entry.carbsG || 0),
          fat: acc.fat + Number(entry.fatG || 0),
          fiber: acc.fiber + Number(entry.fiberG || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );

      return { entries, totals };
    }),

  getWeekSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const summary = await ctx.db
        .select({
          date: diaryEntries.date,
          totalCalories: sql<number>`sum(${diaryEntries.calories})::numeric`,
          totalProtein: sql<number>`sum(${diaryEntries.proteinG})::numeric`,
          totalCarbs: sql<number>`sum(${diaryEntries.carbsG})::numeric`,
          totalFat: sql<number>`sum(${diaryEntries.fatG})::numeric`,
          totalFiber: sql<number>`sum(${diaryEntries.fiberG})::numeric`,
          entryCount: sql<number>`count(*)::int`,
        })
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, ctx.user.id),
            sql`${diaryEntries.date} >= ${input.startDate}`,
            sql`${diaryEntries.date} <= ${input.endDate}`
          )
        )
        .groupBy(diaryEntries.date)
        .orderBy(diaryEntries.date);

      return summary;
    }),

  logFood: protectedProcedure
    .input(logFoodSchema)
    .mutation(async ({ ctx, input }) => {
      await diaryService.logFood(ctx.db, ctx.user.id, input);
      return { success: true };
    }),

  removeEntry: protectedProcedure
    .input(removeEntrySchema)
    .mutation(async ({ ctx, input }) => {
      await diaryService.removeEntry(ctx.db, ctx.user.id, input.entryId);
      return { success: true };
    }),

  updateEntryServings: protectedProcedure
    .input(updateEntryServingsSchema)
    .mutation(async ({ ctx, input }) => {
      await diaryService.updateEntryServings(
        ctx.db,
        ctx.user.id,
        input.entryId,
        input.servingQty
      );
      return { success: true };
    }),

  getDayNutrients: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        nutrientIds: z.array(z.number()).min(1).max(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select({
          nutrientId: foodNutrients.nutrientId,
          name: nutrientDefinitions.name,
          unit: nutrientDefinitions.unit,
          dailyValue: nutrientDefinitions.dailyValue,
          totalAmount: sql<string>`sum(cast(${foodNutrients.amount} as numeric) * cast(${diaryEntries.servingQty} as numeric))`,
        })
        .from(diaryEntries)
        .innerJoin(foodNutrients, eq(foodNutrients.foodId, diaryEntries.foodId))
        .innerJoin(nutrientDefinitions, eq(nutrientDefinitions.id, foodNutrients.nutrientId))
        .where(
          and(
            eq(diaryEntries.userId, ctx.user.id),
            eq(diaryEntries.date, input.date),
            inArray(foodNutrients.nutrientId, input.nutrientIds)
          )
        )
        .groupBy(foodNutrients.nutrientId, nutrientDefinitions.name, nutrientDefinitions.unit, nutrientDefinitions.dailyValue);

      return results.map((r) => ({
        nutrientId: r.nutrientId,
        name: r.name,
        unit: r.unit,
        dailyValue: r.dailyValue ? Number(r.dailyValue) : null,
        totalAmount: Number(r.totalAmount || 0),
      }));
    }),

  getNutrientSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        nutrientIds: z.array(z.number()).min(1).max(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select({
          date: diaryEntries.date,
          nutrientId: foodNutrients.nutrientId,
          name: nutrientDefinitions.name,
          unit: nutrientDefinitions.unit,
          totalAmount: sql<string>`sum(cast(${foodNutrients.amount} as numeric) * cast(${diaryEntries.servingQty} as numeric))`,
        })
        .from(diaryEntries)
        .innerJoin(foodNutrients, eq(foodNutrients.foodId, diaryEntries.foodId))
        .innerJoin(nutrientDefinitions, eq(nutrientDefinitions.id, foodNutrients.nutrientId))
        .where(
          and(
            eq(diaryEntries.userId, ctx.user.id),
            sql`${diaryEntries.date} >= ${input.startDate}`,
            sql`${diaryEntries.date} <= ${input.endDate}`,
            inArray(foodNutrients.nutrientId, input.nutrientIds)
          )
        )
        .groupBy(diaryEntries.date, foodNutrients.nutrientId, nutrientDefinitions.name, nutrientDefinitions.unit)
        .orderBy(diaryEntries.date);

      return results.map((r) => ({
        date: r.date,
        nutrientId: r.nutrientId,
        name: r.name,
        unit: r.unit,
        totalAmount: Number(r.totalAmount || 0),
      }));
    }),

  copyMealToDate: protectedProcedure
    .input(copyMealSchema)
    .mutation(async ({ ctx, input }) => {
      return diaryService.copyMealToDate(ctx.db, ctx.user.id, input);
    }),
});
