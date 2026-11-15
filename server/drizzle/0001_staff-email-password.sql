ALTER TABLE `users` MODIFY COLUMN `phone` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `email` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);