CREATE TABLE `savedAnalyticsViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`datePreset` varchar(20) NOT NULL,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`campaignIdsJson` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedAnalyticsViews_id` PRIMARY KEY(`id`)
);
