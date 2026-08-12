CREATE TABLE `campaignAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('meta','tiktok','youtube') NOT NULL,
	`assetType` enum('image','video','audio','copy_sheet') NOT NULL,
	`format` varchar(120) NOT NULL,
	`label` varchar(220) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(700) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`width` int,
	`height` int,
	`durationSeconds` int,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaignAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignName` varchar(220),
	`productName` varchar(180) NOT NULL,
	`industry` varchar(140) NOT NULL,
	`targetAudience` text NOT NULL,
	`goal` varchar(160) NOT NULL,
	`tone` varchar(120) NOT NULL,
	`platforms` varchar(255) NOT NULL,
	`status` enum('draft','complete','failed') NOT NULL DEFAULT 'draft',
	`briefJson` text NOT NULL,
	`insightsJson` text,
	`exportKey` varchar(512),
	`exportUrl` varchar(700),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
