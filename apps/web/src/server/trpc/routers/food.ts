import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createFoodSchema, createFoodFromBarcodeSchema, updateFoodSchema } from "@open-health/shared/schemas";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { foods, foodNutrients, nutrientDefinitions, foodServings, quickFoods, diaryEntries } from "@/server/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { lookupOpenFoodFacts } from "@/server/services/openfoodfacts";
import { recognizeNutritionLabel, estimateNutritionFromText } from "@/server/services/ai";
import { checkAndIncrementAiUsage } from "@/server/services/plan";
import { createCustomFood, createFoodFromBarcode } from "@/server/services/food-mutation";

async function fetchFoodNutrientsAndServings(db: typeof import("@/server/db").db, foodId: string) {
  return Promise.all([
    db
      .select({
        name: nutrientDefinitions.name,
        unit: nutrientDefinitions.unit,
        category: nutrientDefinitions.category,
        amount: foodNutrients.amount,
        dailyValue: nutrientDefinitions.dailyValue,
        displayOrder: nutrientDefinitions.displayOrder,
      })
      .from(foodNutrients)
      .innerJoin(
        nutrientDefinitions,
        eq(foodNutrients.nutrientId, nutrientDefinitions.id)
      )
      .where(eq(foodNutrients.foodId, foodId))
      .orderBy(nutrientDefinitions.displayOrder),
    db
      .select()
      .from(foodServings)
      .where(eq(foodServings.foodId, foodId)),
  ]);
}

export const foodRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0), // kept for mobile backward compat
        cursor: z.number().min(0).default(0), // used by web infinite scroll
      })
    )
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      const likePattern = `%${query}%`;
      const effectiveOffset = input.cursor || input.offset;

      const results = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
          source: foods.source,
          isVerified: foods.isVerified,
        })
        .from(foods)
        .where(
          sql`(${foods.name} ILIKE ${likePattern} OR coalesce(${foods.brand}, '') ILIKE ${likePattern})`
        )
        .orderBy(
          sql`CASE WHEN ${foods.name} ILIKE ${likePattern} THEN 0 ELSE 1 END, ${foods.name}`
        )
        .limit(input.limit)
        .offset(effectiveOffset);

      return results;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const food = await ctx.db.query.foods.findFirst({
        where: eq(foods.id, input.id),
      });

      if (!food) return null;

      const [nutrients, servings] = await fetchFoodNutrientsAndServings(ctx.db, input.id);
      return { ...food, nutrients, servings };
    }),

  getByBarcode: publicProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const food = await ctx.db.query.foods.findFirst({
        where: eq(foods.barcode, input.barcode),
      });

      if (!food) return null;

      const [nutrients, servings] = await fetchFoodNutrientsAndServings(ctx.db, food.id);
      return { ...food, nutrients, servings };
    }),

  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }))
    .query(async ({ ctx, input }) => {
      const recent = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
          useCount: quickFoods.useCount,
        })
        .from(quickFoods)
        .innerJoin(foods, eq(quickFoods.foodId, foods.id))
        .where(eq(quickFoods.userId, ctx.user.id))
        .orderBy(desc(quickFoods.lastUsedAt))
        .limit(input.limit);

      return recent;
    }),

  getFrequent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
          useCount: quickFoods.useCount,
        })
        .from(quickFoods)
        .innerJoin(foods, eq(quickFoods.foodId, foods.id))
        .where(
          and(
            eq(quickFoods.userId, ctx.user.id),
            gte(quickFoods.lastUsedAt, thirtyDaysAgo)
          )
        )
        .orderBy(desc(quickFoods.useCount), desc(quickFoods.lastUsedAt))
        .limit(input.limit)
        .offset(input.cursor);

      return results;
    }),

  getGlobalPopular: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
          totalUseCount: sql<number>`cast(sum(${quickFoods.useCount}) as int)`.as("total_use_count"),
        })
        .from(quickFoods)
        .innerJoin(foods, eq(quickFoods.foodId, foods.id))
        .groupBy(foods.id)
        .orderBy(sql`total_use_count desc`)
        .limit(input.limit)
        .offset(input.cursor);

      return results;
    }),

  // Keep for mobile backward compat
  getGlobalRecent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(20) }))
    .query(async ({ ctx, input }) => {
      const recent = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
        })
        .from(foods)
        .orderBy(desc(foods.createdAt))
        .limit(input.limit);

      return recent;
    }),

  createCustomFood: protectedProcedure
    .input(createFoodSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createCustomFood(ctx.db, ctx.user.id, input);
      return { success: true, foodId: result.foodId };
    }),

  createFoodFromBarcode: protectedProcedure
    .input(createFoodFromBarcodeSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createFoodFromBarcode(ctx.db, ctx.user.id, input);
      return { success: true, foodId: result.foodId };
    }),

  lookupBarcode: protectedProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return lookupOpenFoodFacts(input.barcode);
    }),

  recognizeLabel: protectedProcedure
    .input(z.object({ base64Image: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const usage = await checkAndIncrementAiUsage(ctx.user.id, "ocr", ctx.userPlan);
      if (!usage.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Today's AI scan limit has been reached (${usage.limit} uses)`,
        });
      }
      return recognizeNutritionLabel(input.base64Image);
    }),

  estimateNutrition: protectedProcedure
    .input(z.object({ description: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const usage = await checkAndIncrementAiUsage(ctx.user.id, "estimate", ctx.userPlan);
      if (!usage.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Today's AI estimate limit has been reached (${usage.limit} uses)`,
        });
      }
      return estimateNutritionFromText(input.description);
    }),

  getMyFoods: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          calories: foods.calories,
          servingSize: foods.servingSize,
          servingUnit: foods.servingUnit,
          householdServing: foods.householdServing,
          source: foods.source,
        })
        .from(foods)
        .where(
          and(
            eq(foods.createdBy, ctx.user.id),
            eq(foods.source, "user")
          )
        )
        .orderBy(desc(foods.createdAt))
        .limit(input.limit)
        .offset(input.cursor);

      return results;
    }),

  deleteFood: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const food = await ctx.db.query.foods.findFirst({
        where: eq(foods.id, input.id),
      });

      if (!food) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Food not found",
        });
      }

      if (food.createdBy !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete foods you created",
        });
      }

      // Delete diary entries referencing this food
      await ctx.db.delete(diaryEntries).where(eq(diaryEntries.foodId, input.id));
      // Delete quick foods (has cascade but be explicit)
      await ctx.db.delete(quickFoods).where(eq(quickFoods.foodId, input.id));
      // Delete nutrients and servings
      await ctx.db.delete(foodNutrients).where(eq(foodNutrients.foodId, input.id));
      await ctx.db.delete(foodServings).where(eq(foodServings.foodId, input.id));
      // Delete the food itself
      await ctx.db.delete(foods).where(eq(foods.id, input.id));

      return { success: true };
    }),

  updateFood: protectedProcedure
    .input(updateFoodSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.foods.findFirst({
        where: eq(foods.id, input.id),
      });

      if (!existing) {
        throw new Error("Food not found");
      }

      if (existing.createdBy !== ctx.user.id) {
        throw new Error("You can only edit foods you created");
      }

      const { id, nutrients, alternateServings, ...updateFields } = input;

      // Build update object with only provided fields
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (updateFields.name !== undefined) updates.name = updateFields.name;
      if (updateFields.brand !== undefined) updates.brand = updateFields.brand;
      if (updateFields.description !== undefined) updates.description = updateFields.description;
      if (updateFields.servingSize !== undefined) updates.servingSize = String(updateFields.servingSize);
      if (updateFields.servingUnit !== undefined) updates.servingUnit = updateFields.servingUnit;
      if (updateFields.householdServing !== undefined) updates.householdServing = updateFields.householdServing;
      if (updateFields.calories !== undefined) updates.calories = String(updateFields.calories);

      await ctx.db.update(foods).set(updates).where(eq(foods.id, id));

      // Replace nutrients if provided
      if (nutrients !== undefined) {
        await ctx.db.delete(foodNutrients).where(eq(foodNutrients.foodId, id));
        if (nutrients.length > 0) {
          await ctx.db.insert(foodNutrients).values(
            nutrients.map((n) => ({
              foodId: id,
              nutrientId: n.nutrientId,
              amount: String(n.amount),
            }))
          );
        }
      }

      // Replace alternate servings if provided
      if (alternateServings !== undefined) {
        await ctx.db.delete(foodServings).where(eq(foodServings.foodId, id));
        if (alternateServings.length > 0) {
          await ctx.db.insert(foodServings).values(
            alternateServings.map((s) => ({
              foodId: id,
              label: s.label,
              grams: String(s.grams),
            }))
          );
        }
      }

      return { success: true };
    }),
});
