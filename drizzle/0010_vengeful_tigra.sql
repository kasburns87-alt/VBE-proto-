CREATE TABLE `purchaseOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`campaignId` int,
	`offerName` varchar(220) NOT NULL,
	`purchaseDate` varchar(10) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`acquisitionChannel` varchar(120),
	`outcome` enum('completed','refunded','cancelled') NOT NULL DEFAULT 'completed',
	`customerReference` varchar(180),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOutcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchaseOutcomes` ADD CONSTRAINT `purchaseOutcomes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOutcomes` ADD CONSTRAINT `purchaseOutcomes_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOutcomes` ADD CONSTRAINT `purchaseOutcomes_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `purchase_outcomes_owner_date_idx` ON `purchaseOutcomes` (`userId`,`purchaseDate`);--> statement-breakpoint
CREATE INDEX `purchase_outcomes_owner_campaign_idx` ON `purchaseOutcomes` (`userId`,`campaignId`);