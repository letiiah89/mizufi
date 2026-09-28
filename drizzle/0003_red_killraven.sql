CREATE TABLE `vip_purchases` (
	`stripe_event_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payment_intent_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vip_purchases_user_id` ON `vip_purchases` (`user_id`);
