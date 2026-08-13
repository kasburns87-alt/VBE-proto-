CREATE TABLE `emailSuppressions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`reason` enum('unsubscribe','bounce','complaint','manual') NOT NULL,
	`sourceEventId` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSuppressions_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_suppressions_owner_email_unique` UNIQUE(`userId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `emailWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerEventId` varchar(160) NOT NULL,
	`providerMessageId` varchar(160),
	`eventType` varchar(80) NOT NULL,
	`userId` int,
	`communicationId` int,
	`payloadJson` text NOT NULL,
	`status` enum('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
	`errorMessage` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `emailWebhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_webhook_events_provider_event_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
ALTER TABLE `clientCommunications` MODIFY COLUMN `status` enum('draft','queued','sent','delivered','bounced','complained','suppressed','unsubscribed','received','failed') NOT NULL;--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD `messageId` varchar(320);--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD `referencesHeader` text;--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD `threadKey` varchar(320);--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD `idempotencyKey` varchar(180);--> statement-breakpoint
ALTER TABLE `clientCommunications` ADD CONSTRAINT `client_comms_idempotency_unique` UNIQUE(`idempotencyKey`);--> statement-breakpoint
ALTER TABLE `emailSuppressions` ADD CONSTRAINT `emailSuppressions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailWebhookEvents` ADD CONSTRAINT `emailWebhookEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailWebhookEvents` ADD CONSTRAINT `emailWebhookEvents_communicationId_clientCommunications_id_fk` FOREIGN KEY (`communicationId`) REFERENCES `clientCommunications`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_webhook_events_owner_created_idx` ON `emailWebhookEvents` (`userId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `client_comms_owner_thread_idx` ON `clientCommunications` (`userId`,`threadKey`,`createdAt`);