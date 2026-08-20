DROP INDEX "blog_posts_slug_idx";--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "locale" varchar(10) DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_locale_idx" ON "blog_posts" USING btree ("slug","locale");--> statement-breakpoint
CREATE INDEX "blog_posts_locale_idx" ON "blog_posts" USING btree ("locale");