CREATE TABLE `finance_profiles_by_user` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `monetization_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`placement` text NOT NULL,
	`partner` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_monetization_events_type_created_at` ON `monetization_events` (`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_monetization_events_user_created_at` ON `monetization_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`subscription_status` text DEFAULT 'inactive' NOT NULL,
	`subscription_ends_at` integer,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL
);
