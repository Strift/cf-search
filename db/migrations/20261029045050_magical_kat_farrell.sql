CREATE TABLE `cards` (
	`oracle_id` text PRIMARY KEY NOT NULL,
	`scryfall_id` text NOT NULL,
	`name` text NOT NULL,
	`layout` text NOT NULL,
	`mana_cost` text,
	`cmc` real NOT NULL,
	`type_line` text NOT NULL,
	`oracle_text` text,
	`power` text,
	`toughness` text,
	`loyalty` text,
	`defense` text,
	`colors` text NOT NULL,
	`color_identity` text NOT NULL,
	`keywords` text NOT NULL,
	`legalities` text NOT NULL,
	`rarity` text NOT NULL,
	`set_code` text NOT NULL,
	`set_name` text NOT NULL,
	`collector_number` text NOT NULL,
	`released_at` text NOT NULL,
	`edhrec_rank` integer,
	`image_uris` text,
	`card_faces` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_name_idx` ON `cards` (`name`);--> statement-breakpoint
CREATE INDEX `cards_cmc_idx` ON `cards` (`cmc`);--> statement-breakpoint
CREATE INDEX `cards_rarity_idx` ON `cards` (`rarity`);--> statement-breakpoint
CREATE INDEX `cards_set_code_idx` ON `cards` (`set_code`);--> statement-breakpoint
CREATE INDEX `cards_edhrec_rank_idx` ON `cards` (`edhrec_rank`);