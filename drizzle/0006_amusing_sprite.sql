CREATE TABLE `userUsageCounters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`campaignGenerations` int NOT NULL DEFAULT 0,
	`assistantRequests` int NOT NULL DEFAULT 0,
	`reportGenerations` int NOT NULL DEFAULT 0,
	`outboundEmails` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userUsageCounters_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_usage_counters_owner_period_unique` UNIQUE(`userId`,`periodKey`)
);
--> statement-breakpoint
ALTER TABLE `userUsageCounters` ADD CONSTRAINT `userUsageCounters_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;