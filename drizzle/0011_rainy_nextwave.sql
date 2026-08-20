CREATE TABLE `moduleIntegrationContracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`sourceModule` enum('brandforge','pulseforge','launchpro') NOT NULL,
	`targetModule` enum('brandforge','pulseforge','launchpro') NOT NULL,
	`contractType` enum('brand_profile_snapshot','brand_asset_reference','campaign_pack_manifest','approval_decision','performance_snapshot','outcome_signal') NOT NULL,
	`contractVersion` varchar(24) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(180) NOT NULL,
	`status` enum('draft','approved','rejected','superseded') NOT NULL DEFAULT 'draft',
	`payloadJson` text NOT NULL,
	`correlationId` varchar(120) NOT NULL,
	`idempotencyKey` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `moduleIntegrationContracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `module_contracts_workspace_idempotency_unique` UNIQUE(`workspaceId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `workspaceMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaceMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_memberships_workspace_user_unique` UNIQUE(`workspaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `moduleIntegrationContracts` ADD CONSTRAINT `moduleIntegrationContracts_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moduleIntegrationContracts` ADD CONSTRAINT `moduleIntegrationContracts_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaceMemberships` ADD CONSTRAINT `workspaceMemberships_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaceMemberships` ADD CONSTRAINT `workspaceMemberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `module_contracts_workspace_entity_created_idx` ON `moduleIntegrationContracts` (`workspaceId`,`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `module_contracts_workspace_target_status_idx` ON `moduleIntegrationContracts` (`workspaceId`,`targetModule`,`status`);--> statement-breakpoint
CREATE INDEX `workspace_memberships_user_workspace_idx` ON `workspaceMemberships` (`userId`,`workspaceId`);--> statement-breakpoint
CREATE INDEX `workspaces_creator_updated_idx` ON `workspaces` (`createdByUserId`,`updatedAt`);