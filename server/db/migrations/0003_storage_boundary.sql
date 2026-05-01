PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `characters` (
  `id` TEXT PRIMARY KEY,
  `char_id` TEXT,
  `data` TEXT NOT NULL,
  `created_at` TEXT
);
--> statement-breakpoint
ALTER TABLE `characters` RENAME TO `characters_blob_legacy`;
--> statement-breakpoint
CREATE TABLE `characters` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `avatar` text,
  `tags` text,
  `group_name` text,
  `core` text DEFAULT '' NOT NULL,
  `persona` text,
  `description` text,
  `sample` text,
  `timezone` text,
  `api_preset_id` text,
  `is_favorite` integer DEFAULT 0 NOT NULL,
  `is_blacklisted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  `metadata` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `characters`
  (`id`, `name`, `avatar`, `tags`, `group_name`, `core`, `persona`, `description`, `sample`, `timezone`, `api_preset_id`, `is_favorite`, `is_blacklisted`, `created_at`, `updated_at`, `metadata`)
SELECT
  CAST(json_extract(`data`, '$.id') AS TEXT),
  COALESCE(json_extract(`data`, '$.name'), ''),
  json_extract(`data`, '$.avatar'),
  json_extract(`data`, '$.tags'),
  json_extract(`data`, '$.group'),
  COALESCE(json_extract(`data`, '$.core'), ''),
  json_extract(`data`, '$.persona'),
  json_extract(`data`, '$.description'),
  json_extract(`data`, '$.sample'),
  json_extract(`data`, '$.timezone'),
  json_extract(`data`, '$.apiPresetId'),
  COALESCE(json_extract(`data`, '$.isFavorite'), 0),
  COALESCE(json_extract(`data`, '$.isBlacklisted'), 0),
  COALESCE(json_extract(`data`, '$.createdAt'), `created_at`, datetime('now')),
  json_extract(`data`, '$.updatedAt'),
  `data`
FROM `characters_blob_legacy`
WHERE json_valid(`data`) AND json_extract(`data`, '$.id') IS NOT NULL;
--> statement-breakpoint
DROP TABLE `characters_blob_legacy`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_characters_api_preset_id` ON `characters` (`api_preset_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
  `id` TEXT PRIMARY KEY,
  `char_id` TEXT,
  `data` TEXT NOT NULL,
  `created_at` TEXT
);
--> statement-breakpoint
ALTER TABLE `messages` RENAME TO `messages_blob_legacy`;
--> statement-breakpoint
CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `char_id` text REFERENCES `characters`(`id`) ON DELETE cascade,
  `persona_id` text,
  `sender` text NOT NULL,
  `role` text,
  `content` text DEFAULT '' NOT NULL,
  `mode` text DEFAULT 'online' NOT NULL,
  `timestamp` text NOT NULL,
  `user_timestamp` text,
  `char_timestamp` text,
  `variable_snapshot` text,
  `created_at` text NOT NULL,
  `metadata` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `messages`
  (`id`, `char_id`, `persona_id`, `sender`, `role`, `content`, `mode`, `timestamp`, `user_timestamp`, `char_timestamp`, `variable_snapshot`, `created_at`, `metadata`)
SELECT
  CAST(json_extract(`data`, '$.id') AS TEXT),
  json_extract(`data`, '$.charId'),
  json_extract(`data`, '$.personaId'),
  COALESCE(json_extract(`data`, '$.sender'), json_extract(`data`, '$.role'), 'user'),
  json_extract(`data`, '$.role'),
  COALESCE(json_extract(`data`, '$.content'), ''),
  COALESCE(json_extract(`data`, '$.mode'), 'online'),
  COALESCE(json_extract(`data`, '$.timestamp'), json_extract(`data`, '$.createdAt'), `created_at`, datetime('now')),
  json_extract(`data`, '$.userTimestamp'),
  json_extract(`data`, '$.charTimestamp'),
  json_extract(`data`, '$.variableSnapshot'),
  COALESCE(json_extract(`data`, '$.createdAt'), json_extract(`data`, '$.timestamp'), `created_at`, datetime('now')),
  `data`
FROM `messages_blob_legacy`
WHERE json_valid(`data`) AND json_extract(`data`, '$.id') IS NOT NULL;
--> statement-breakpoint
DROP TABLE `messages_blob_legacy`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_char_timestamp` ON `messages` (`char_id`, `timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_persona_id` ON `messages` (`persona_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `summaries` (
  `id` TEXT PRIMARY KEY,
  `char_id` TEXT,
  `data` TEXT NOT NULL,
  `created_at` TEXT
);
--> statement-breakpoint
ALTER TABLE `summaries` RENAME TO `summaries_blob_legacy`;
--> statement-breakpoint
CREATE TABLE `summaries` (
  `id` text PRIMARY KEY NOT NULL,
  `char_id` text REFERENCES `characters`(`id`) ON DELETE cascade,
  `persona_id` text,
  `type` text NOT NULL,
  `level` text,
  `content` text DEFAULT '' NOT NULL,
  `date` text,
  `message_ids` text,
  `source_ids` text,
  `start_msg_id` text,
  `importance` real,
  `keywords` text,
  `period` text,
  `created_at` text NOT NULL,
  `metadata` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `summaries`
  (`id`, `char_id`, `persona_id`, `type`, `level`, `content`, `date`, `message_ids`, `source_ids`, `start_msg_id`, `importance`, `keywords`, `period`, `created_at`, `metadata`)
SELECT
  CAST(json_extract(`data`, '$.id') AS TEXT),
  json_extract(`data`, '$.charId'),
  json_extract(`data`, '$.personaId'),
  COALESCE(json_extract(`data`, '$.type'), json_extract(`data`, '$.level'), 'summary'),
  json_extract(`data`, '$.level'),
  COALESCE(json_extract(`data`, '$.content'), ''),
  json_extract(`data`, '$.date'),
  json_extract(`data`, '$.messageIds'),
  json_extract(`data`, '$.sourceIds'),
  json_extract(`data`, '$.startMsgId'),
  json_extract(`data`, '$.importance'),
  json_extract(`data`, '$.keywords'),
  json_extract(`data`, '$.period'),
  COALESCE(json_extract(`data`, '$.createdAt'), `created_at`, datetime('now')),
  `data`
FROM `summaries_blob_legacy`
WHERE json_valid(`data`) AND json_extract(`data`, '$.id') IS NOT NULL;
--> statement-breakpoint
DROP TABLE `summaries_blob_legacy`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_summaries_char_type_date` ON `summaries` (`char_id`, `type`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_summaries_created_at` ON `summaries` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memories` (
  `id` TEXT PRIMARY KEY,
  `char_id` TEXT,
  `data` TEXT NOT NULL,
  `created_at` TEXT
);
--> statement-breakpoint
ALTER TABLE `memories` RENAME TO `memories_blob_legacy`;
--> statement-breakpoint
CREATE TABLE `memories` (
  `id` text PRIMARY KEY NOT NULL,
  `char_id` text REFERENCES `characters`(`id`) ON DELETE cascade,
  `content` text DEFAULT '' NOT NULL,
  `text_alias` text,
  `type` text,
  `category` text,
  `source` text,
  `source_id` text,
  `tags` text,
  `importance` real,
  `timestamp` text,
  `created_at` text NOT NULL,
  `metadata` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `memories`
  (`id`, `char_id`, `content`, `text_alias`, `type`, `category`, `source`, `source_id`, `tags`, `importance`, `timestamp`, `created_at`, `metadata`)
SELECT
  CAST(json_extract(`data`, '$.id') AS TEXT),
  json_extract(`data`, '$.charId'),
  COALESCE(json_extract(`data`, '$.content'), json_extract(`data`, '$.text'), ''),
  json_extract(`data`, '$.text'),
  json_extract(`data`, '$.type'),
  json_extract(`data`, '$.category'),
  json_extract(`data`, '$.source'),
  json_extract(`data`, '$.sourceId'),
  json_extract(`data`, '$.tags'),
  json_extract(`data`, '$.importance'),
  json_extract(`data`, '$.timestamp'),
  COALESCE(json_extract(`data`, '$.createdAt'), `created_at`, datetime('now')),
  `data`
FROM `memories_blob_legacy`
WHERE json_valid(`data`) AND json_extract(`data`, '$.id') IS NOT NULL;
--> statement-breakpoint
DROP TABLE `memories_blob_legacy`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_memories_char_importance` ON `memories` (`char_id`, `importance`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_memories_source` ON `memories` (`source`, `source_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ux_character_values_character_variable` ON `character_values` (`character_id`, `variable_name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `active` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `presets` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prompt_presets` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `char_stats` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stat_defs` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `life` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `items` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `timeline` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skills` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `relations` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dreams` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `personas` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `maps` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calendar_events` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dafu_game` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diary` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `suixiang_cards` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `suixiang_entries` (`id` TEXT PRIMARY KEY, `char_id` TEXT, `data` TEXT NOT NULL, `created_at` TEXT);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_active_char_id` ON `active` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_presets_char_id` ON `presets` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prompt_presets_char_id` ON `prompt_presets` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_char_stats_char_id` ON `char_stats` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_stat_defs_char_id` ON `stat_defs` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_life_char_id` ON `life` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_items_char_id` ON `items` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_timeline_char_id` ON `timeline` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_skills_char_id` ON `skills` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_relations_char_id` ON `relations` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dreams_char_id` ON `dreams` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_personas_char_id` ON `personas` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_maps_char_id` ON `maps` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calendar_events_char_id` ON `calendar_events` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dafu_game_char_id` ON `dafu_game` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_char_id` ON `diary` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_suixiang_cards_char_id` ON `suixiang_cards` (`char_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_suixiang_entries_char_id` ON `suixiang_entries` (`char_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
