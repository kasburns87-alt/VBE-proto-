CREATE TABLE `businessProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessName` varchar(180) NOT NULL,
	`websiteDomain` varchar(240),
	`industry` varchar(140) NOT NULL,
	`coreOffer` text NOT NULL,
	`targetAudience` text NOT NULL,
	`brandVoice` varchar(180) NOT NULL,
	`differentiators` text,
	`strategicGoals` text,
	`marketContext` text,
	`guardrails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `businessProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `marketingExecutiveRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`profileId` int,
	`prompt` text NOT NULL,
	`runType` enum('campaign_plan','performance_review','market_signal_review','material_refresh') NOT NULL,
	`status` enum('complete','failed') NOT NULL DEFAULT 'complete',
	`outputJson` text,
	`evidenceJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketingExecutiveRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `businessProfiles` ADD CONSTRAINT `businessProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketingExecutiveRuns` ADD CONSTRAINT `marketingExecutiveRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketingExecutiveRuns` ADD CONSTRAINT `marketingExecutiveRuns_profileId_businessProfiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `businessProfiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `marketing_executive_runs_owner_created_idx` ON `marketingExecutiveRuns` (`userId`,`createdAt`);