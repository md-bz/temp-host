ALTER TABLE `settings` RENAME TO `settings_old`;--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
INSERT INTO `settings` (`key`, `value`)
SELECT 'signupRestricted', CASE WHEN `signup_restricted` THEN 'true' ELSE 'false' END FROM `settings_old`;--> statement-breakpoint
DROP TABLE `settings_old`;
