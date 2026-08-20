import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// Custom reminders — user-defined alarms for any purpose
export const customReminders = pgTable(
  "custom_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(), // e.g. "Take vitamin B"
    type: text("type").default("custom").notNull(), // preset: water, exercise, meditation, medication, sleep, custom
    note: text("note"), // free-form note shown in notification
    time: text("time").notNull(), // HH:mm format
    repeatDays: jsonb("repeat_days").$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]).notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
    enabled: boolean("enabled").default(true).notNull(),
    icon: text("icon"), // optional emoji or icon name
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("custom_reminders_user_idx").on(table.userId),
    index("custom_reminders_user_enabled_idx").on(table.userId, table.enabled),
    check("custom_reminders_repeat_days_is_array", sql`jsonb_typeof(${table.repeatDays}) = 'array'`),
  ]
);
