ALTER TABLE `campaigns` ADD `workspaceId` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `workspaceId` int;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `campaigns_workspace_updated_idx` ON `campaigns` (`workspaceId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `clients_workspace_status_updated_idx` ON `clients` (`workspaceId`,`status`,`updatedAt`);