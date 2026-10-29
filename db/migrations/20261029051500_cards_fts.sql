CREATE VIRTUAL TABLE `cards_fts` USING fts5(`oracle_id` UNINDEXED, `name`, tokenize = 'unicode61 remove_diacritics 2');--> statement-breakpoint
INSERT INTO `cards_fts` (`oracle_id`, `name`) SELECT `oracle_id`, `name` FROM `cards`;--> statement-breakpoint
CREATE TRIGGER `cards_fts_insert` AFTER INSERT ON `cards` BEGIN
  INSERT INTO `cards_fts` (`oracle_id`, `name`) VALUES (new.`oracle_id`, new.`name`);
END;--> statement-breakpoint
CREATE TRIGGER `cards_fts_delete` AFTER DELETE ON `cards` BEGIN
  DELETE FROM `cards_fts` WHERE `oracle_id` = old.`oracle_id`;
END;--> statement-breakpoint
CREATE TRIGGER `cards_fts_update` AFTER UPDATE OF `name` ON `cards` BEGIN
  UPDATE `cards_fts` SET `name` = new.`name` WHERE `oracle_id` = old.`oracle_id`;
END;
