import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  date,
  decimal,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export const unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);
export const sexEnum = pgEnum("sex", ["male", "female", "other"]);
export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extremely_active",
]);
export const goalTypeEnum = pgEnum("goal_type", ["lose", "maintain", "gain"]);
export const targetModeEnum = pgEnum("target_mode", ["grams", "percentage"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  image: text("image"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  unitSystem: unitSystemEnum("unit_system").default("metric"),
  referralCode: varchar("referral_code", { length: 12 }).unique(),
  plan: text("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  dateOfBirth: date("date_of_birth"),
  sex: sexEnum("sex"),
  heightCm: decimal("height_cm", { precision: 5, scale: 1 }),
  currentWeightKg: decimal("current_weight_kg", { precision: 5, scale: 1 }),
  medicalConditions: jsonb("medical_conditions").$type<string[]>(),
  medications: text("medications"),
  allergies: text("allergies"),
  dietaryPreference: varchar("dietary_preference", { length: 80 }),
  primaryGoal: varchar("primary_goal", { length: 80 }),
  teamColor: varchar("team_color", { length: 12 }),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  activityLevel: activityLevelEnum("activity_level").default("moderately_active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hubConfig = pgTable("hub_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  config: jsonb("config").$type<Record<string, { visible: boolean; order?: number }>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userGoals = pgTable("user_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  goalType: goalTypeEnum("goal_type").default("maintain"),
  targetWeightKg: decimal("target_weight_kg", { precision: 5, scale: 1 }),
  weeklyRateKg: decimal("weekly_rate_kg", { precision: 3, scale: 2 }),
  calorieTarget: integer("calorie_target"),
  proteinG: decimal("protein_g", { precision: 5, scale: 1 }),
  carbsG: decimal("carbs_g", { precision: 5, scale: 1 }),
  fatG: decimal("fat_g", { precision: 5, scale: 1 }),
  fiberG: decimal("fiber_g", { precision: 5, scale: 1 }),
  proteinPct: decimal("protein_pct", { precision: 4, scale: 1 }),
  carbsPct: decimal("carbs_pct", { precision: 4, scale: 1 }),
  fatPct: decimal("fat_pct", { precision: 4, scale: 1 }),
  targetMode: targetModeEnum("target_mode").default("percentage"),
  trackedNutrientIds: jsonb("tracked_nutrient_ids").$type<number[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
