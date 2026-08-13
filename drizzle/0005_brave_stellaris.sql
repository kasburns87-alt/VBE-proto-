CREATE TABLE `clientCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`campaignId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientCampaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_campaigns_owner_pair_unique` UNIQUE(`userId`,`clientId`,`campaignId`)
);
--> statement-breakpoint
CREATE TABLE `clientCommunications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`direction` enum('inbound','outbound') NOT NULL,
	`channel` enum('email') NOT NULL DEFAULT 'email',
	`status` enum('draft','queued','sent','delivered','bounced','received','failed') NOT NULL,
	`senderEmail` varchar(320) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(300) NOT NULL,
	`bodyText` text,
	`bodyHtml` text,
	`providerMessageId` varchar(160),
	`inReplyTo` varchar(300),
	`providerEventId` varchar(160),
	`sentAt` timestamp,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientCommunications_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_comms_provider_event_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `clientSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`scheduleType` enum('follow_up','weekly_report','reminder') NOT NULL,
	`label` varchar(180) NOT NULL,
	`recipientEmail` varchar(320),
	`timezone` varchar(80) NOT NULL DEFAULT 'UTC',
	`cronExpression` varchar(80),
	`scheduleCronTaskUid` varchar(65),
	`isEnabled` int NOT NULL DEFAULT 0,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_schedules_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`company` varchar(180),
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`title` varchar(140),
	`industry` varchar(140),
	`status` enum('lead','active','paused','archived') NOT NULL DEFAULT 'lead',
	`notes` text,
	`rapportDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_owner_email_unique` UNIQUE(`userId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `communicationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fromAddress` varchar(320),
	`replyToAddress` varchar(320),
	`inboundAddress` varchar(320),
	`senderName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communicationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `communicationSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `reportDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`scheduleId` int,
	`periodStart` varchar(10) NOT NULL,
	`periodEnd` varchar(10) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`status` enum('queued','generated','sent','failed','skipped') NOT NULL DEFAULT 'queued',
	`fileKey` varchar(512),
	`fileUrl` varchar(700),
	`providerMessageId` varchar(160),
	`errorMessage` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `reportDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_deliveries_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `clientCampaigns` ADD CONSTRAINT `clientCampaigns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientCampaigns` ADD CONSTRAINT `clientCampaigns_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientCampaigns` ADD CONSTRAINT `clientCampaigns_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD CONSTRAINT `clientCommunications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD CONSTRAINT `clientCommunications_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientSchedules` ADD CONSTRAINT `clientSchedules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientSchedules` ADD CONSTRAINT `clientSchedules_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communicationSettings` ADD CONSTRAINT `communicationSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportDeliveries` ADD CONSTRAINT `reportDeliveries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportDeliveries` ADD CONSTRAINT `reportDeliveries_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportDeliveries` ADD CONSTRAINT `reportDeliveries_scheduleId_clientSchedules_id_fk` FOREIGN KEY (`scheduleId`) REFERENCES `clientSchedules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_campaigns_owner_client_idx` ON `clientCampaigns` (`userId`,`clientId`);--> statement-breakpoint
CREATE INDEX `client_comms_owner_created_idx` ON `clientCommunications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `client_comms_owner_client_created_idx` ON `clientCommunications` (`userId`,`clientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `client_schedules_owner_enabled_idx` ON `clientSchedules` (`userId`,`isEnabled`);--> statement-breakpoint
CREATE INDEX `clients_owner_status_updated_idx` ON `clients` (`userId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `report_deliveries_owner_created_idx` ON `reportDeliveries` (`userId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `campaignAnalytics` ADD CONSTRAINT `campaignAnalytics_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaignAnalytics` ADD CONSTRAINT `campaignAnalytics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaignAssets` ADD CONSTRAINT `campaignAssets_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaignAssets` ADD CONSTRAINT `campaignAssets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savedAnalyticsViews` ADD CONSTRAINT `savedAnalyticsViews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `campaign_analytics_owner_date_campaign_idx` ON `campaignAnalytics` (`userId`,`metricDate`,`campaignId`);--> statement-breakpoint
CREATE INDEX `campaign_assets_owner_campaign_created_idx` ON `campaignAssets` (`userId`,`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `campaigns_user_updated_idx` ON `campaigns` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `saved_analytics_views_owner_updated_idx` ON `savedAnalyticsViews` (`userId`,`updatedAt`);