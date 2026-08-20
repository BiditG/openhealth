import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const blogStatusEnum = pgEnum("blog_status", [
  "draft",
  "published",
  "archived",
]);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    youtubeVideoId: varchar("youtube_video_id", { length: 20 }),
    youtubeChannel: varchar("youtube_channel", { length: 255 }),
    videoPublishedAt: timestamp("video_published_at", { withTimezone: true }),
    tags: jsonb("tags").$type<string[]>().default([]),
    locale: varchar("locale", { length: 10 }).default("en").notNull(),
    status: blogStatusEnum("status").default("draft").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("blog_posts_slug_locale_idx").on(table.slug, table.locale),
    uniqueIndex("blog_posts_youtube_video_locale_idx").on(table.youtubeVideoId, table.locale),
    index("blog_posts_status_created_idx").on(table.status, table.createdAt),
    index("blog_posts_locale_idx").on(table.locale),
  ]
);
