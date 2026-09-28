CREATE TABLE `beta_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`context` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_beta_feedback_status_created_at` ON `beta_feedback` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_beta_feedback_user_created_at` ON `beta_feedback` (`user_id`,`created_at`);