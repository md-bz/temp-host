ALTER TABLE `files` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `blocked_at` integer;