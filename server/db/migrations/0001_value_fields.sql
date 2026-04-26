-- Add valueType, sortOrder, groupName to character_values
-- Add description to value_rules
ALTER TABLE `character_values` ADD COLUMN `value_type` text NOT NULL DEFAULT 'continuous';
--> statement-breakpoint
ALTER TABLE `character_values` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `character_values` ADD COLUMN `group_name` text;
--> statement-breakpoint
ALTER TABLE `value_rules` ADD COLUMN `description` text;
