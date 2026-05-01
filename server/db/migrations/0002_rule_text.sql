-- Restructure value_rules: replace automation engine fields with natural-language ruleText
-- Old fields (trigger_on, operation, amount, conditions) are removed.
-- rule_text is now the primary field: AI-readable instruction text.
CREATE TABLE `value_rules_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `value_id` integer NOT NULL REFERENCES `character_values`(`id`) ON DELETE CASCADE,
  `range_min` real,
  `range_max` real,
  `rule_text` text NOT NULL DEFAULT '',
  `enabled` integer NOT NULL DEFAULT 1,
  `created_at` text
);
--> statement-breakpoint
INSERT INTO `value_rules_new` (`id`, `value_id`, `range_min`, `range_max`, `rule_text`, `enabled`, `created_at`)
SELECT `id`, `value_id`, `range_min`, `range_max`, COALESCE(`description`, ''), `enabled`, `created_at`
FROM `value_rules`;
--> statement-breakpoint
DROP TABLE `value_rules`;
--> statement-breakpoint
ALTER TABLE `value_rules_new` RENAME TO `value_rules`;
