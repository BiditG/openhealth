import {
  pgTable,
  uuid,
  text,
  varchar,
  date,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const dailyGuidanceNotifications = pgTable(
  "daily_guidance_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    notificationDate: date("notification_date").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    tone: varchar("tone", { length: 40 }).default("guide").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_guidance_notifications_user_date_title_idx").on(
      table.userId,
      table.notificationDate,
      table.title
    ),
    index("daily_guidance_notifications_user_date_idx").on(table.userId, table.notificationDate),
  ]
);

export const healthTaskCompletions = pgTable(
  "health_task_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    taskDate: date("task_date").notNull(),
    taskKey: varchar("task_key", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    status: varchar("status", { length: 24 }).default("started").notNull(),
    exerciseKey: varchar("exercise_key", { length: 40 }),
    targetReps: integer("target_reps"),
    countedReps: integer("counted_reps").default(0).notNull(),
    medalCode: varchar("medal_code", { length: 80 }),
    medalName: varchar("medal_name", { length: 140 }),
    medalTier: varchar("medal_tier", { length: 40 }),
    medalPoints: integer("medal_points").default(0).notNull(),
    proof: jsonb("proof").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("health_task_completions_user_date_task_idx").on(
      table.userId,
      table.taskDate,
      table.taskKey
    ),
    index("health_task_completions_leaderboard_idx").on(table.completedAt, table.medalPoints),
  ]
);
