CREATE TABLE `finance_space_members` (
	`space_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`role` text DEFAULT 'editor' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_at` integer NOT NULL,
	`joined_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_finance_space_members_space_email` ON `finance_space_members` (`space_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_finance_space_members_user_id` ON `finance_space_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_finance_space_members_email` ON `finance_space_members` (`email`);--> statement-breakpoint
CREATE INDEX `idx_finance_space_members_space_id` ON `finance_space_members` (`space_id`);--> statement-breakpoint
CREATE TABLE `finance_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'personal' NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_finance_spaces_owner_user_id` ON `finance_spaces` (`owner_user_id`);