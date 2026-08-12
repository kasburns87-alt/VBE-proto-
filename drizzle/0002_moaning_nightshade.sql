CREATE TABLE `campaignAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('meta','tiktok','youtube') NOT NULL,
	`metricDate` varchar(10) NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`engagements` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`videoViews` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`spendCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaignAnalytics_id` PRIMARY KEY(`id`)
);
