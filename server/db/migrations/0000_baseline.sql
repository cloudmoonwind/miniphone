CREATE TABLE IF NOT EXISTS `character_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`variable_name` text NOT NULL,
	`current_value` real DEFAULT 0 NOT NULL,
	`min_value` real DEFAULT 0 NOT NULL,
	`max_value` real DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `condition_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`condition_type` text NOT NULL,
	`condition_target` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_books` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`scope` text DEFAULT 'global' NOT NULL,
	`character_id` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_event_id` text NOT NULL,
	`to_event_id` text NOT NULL,
	`relation_type` text NOT NULL,
	FOREIGN KEY (`from_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`tag_type` text NOT NULL,
	`tag_value` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `events` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`character_id` text,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'locked' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`probability` integer DEFAULT 100 NOT NULL,
	`weight` integer DEFAULT 100 NOT NULL,
	`repeatable` integer DEFAULT 0 NOT NULL,
	`max_triggers` integer,
	`trigger_count` integer DEFAULT 0 NOT NULL,
	`unlock_conditions` text,
	`trigger_conditions` text,
	`effects` text,
	`cooldown_type` text DEFAULT 'none',
	`cooldown_value` integer DEFAULT 0,
	`cooldown_remaining` integer DEFAULT 0,
	`condition_cooldown` integer DEFAULT 0,
	`condition_cooldown_remaining` integer DEFAULT 0,
	`steps` text,
	`current_step` text,
	`outcome` text,
	`created_at` text NOT NULL,
	`last_triggered_at` text,
	FOREIGN KEY (`book_id`) REFERENCES `event_books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pending_injections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`content` text NOT NULL,
	`position` text NOT NULL,
	`depth_value` integer,
	`duration_type` text NOT NULL,
	`duration_value` text,
	`remaining_turns` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`char_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`is_active` integer DEFAULT 1,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `value_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value_id` integer NOT NULL,
	`range_min` real,
	`range_max` real,
	`trigger_on` text NOT NULL,
	`conditions` text,
	`operation` text NOT NULL,
	`amount` real NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text,
	FOREIGN KEY (`value_id`) REFERENCES `character_values`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `value_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value_id` integer NOT NULL,
	`range_min` real NOT NULL,
	`range_max` real NOT NULL,
	`stage_name` text NOT NULL,
	`description` text,
	`prompt_snippet` text,
	FOREIGN KEY (`value_id`) REFERENCES `character_values`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `world_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `worldbook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`worldbook_id` text NOT NULL,
	`memo` text,
	`content` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`strategy` text DEFAULT 'constant' NOT NULL,
	`probability` integer DEFAULT 100 NOT NULL,
	`keywords` text,
	`filter_keywords` text,
	`filter_logic` text DEFAULT 'AND_ANY',
	`scan_depth` integer,
	`case_sensitive` integer DEFAULT 0 NOT NULL,
	`match_whole_word` integer DEFAULT 0 NOT NULL,
	`position` text DEFAULT 'system-bottom' NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`order_num` integer DEFAULT 0 NOT NULL,
	`no_recurse` integer DEFAULT 0 NOT NULL,
	`no_further_recurse` integer DEFAULT 0 NOT NULL,
	`inclusion_group` text,
	`group_weight` integer DEFAULT 100 NOT NULL,
	`sticky` integer DEFAULT 0 NOT NULL,
	`cooldown` integer DEFAULT 0 NOT NULL,
	`delay` integer DEFAULT 0 NOT NULL,
	`character_filter` text,
	`filter_mode` text DEFAULT 'include',
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`worldbook_id`) REFERENCES `worldbooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `worldbook_event_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`worldbook_id` text NOT NULL,
	`memo` text,
	`content` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`event_type` text DEFAULT 'random' NOT NULL,
	`probability` integer DEFAULT 100 NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`condition_stat` text,
	`condition_op` text,
	`condition_value` real,
	`tags` text,
	`order_num` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`worldbook_id`) REFERENCES `worldbooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `worldbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`scope` text DEFAULT 'global' NOT NULL,
	`bound_id` text,
	`scan_depth` integer DEFAULT 20 NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
