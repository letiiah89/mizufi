CREATE TABLE `beta_participants` (
	`email` text PRIMARY KEY NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL
);
