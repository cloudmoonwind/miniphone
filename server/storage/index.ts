import { getDb } from '../db/database.js';
import { ColumnarStore } from '../db/ColumnarStore.js';
import { SqliteStore } from '../db/SqliteStore.js';
import type {
  Message, Summary, Character, CharStats, LifeLog,
  Item, TimelineEvent, Skill, Relation, Memory, Dream,
  ApiPreset, PromptPreset, Persona,
  DiaryEntry, Active,
} from '../types.js';

const db = getDb();

// ── 聊天 ─────────────────────────────────────────────────────
export const messageStore = new ColumnarStore<Message>(db, 'messages', [
  { prop: 'id', column: 'id', required: true },
  { prop: 'charId', column: 'char_id' },
  { prop: 'personaId', column: 'persona_id' },
  { prop: 'sender', column: 'sender', required: true },
  { prop: 'role', column: 'role' },
  { prop: 'content', column: 'content', required: true, defaultValue: '' },
  { prop: 'mode', column: 'mode', required: true, defaultValue: 'online' },
  { prop: 'timestamp', column: 'timestamp', required: true },
  { prop: 'userTimestamp', column: 'user_timestamp' },
  { prop: 'charTimestamp', column: 'char_timestamp' },
  { prop: 'variableSnapshot', column: 'variable_snapshot', kind: 'json' },
  { prop: 'createdAt', column: 'created_at', required: true },
], { orderBy: 'timestamp ASC' });

export const summaryStore = new ColumnarStore<Summary>(db, 'summaries', [
  { prop: 'id', column: 'id', required: true },
  { prop: 'charId', column: 'char_id' },
  { prop: 'personaId', column: 'persona_id' },
  { prop: 'type', column: 'type', required: true, defaultValue: 'summary' },
  { prop: 'level', column: 'level' },
  { prop: 'content', column: 'content', required: true, defaultValue: '' },
  { prop: 'date', column: 'date' },
  { prop: 'messageIds', column: 'message_ids', kind: 'json' },
  { prop: 'sourceIds', column: 'source_ids', kind: 'json' },
  { prop: 'startMsgId', column: 'start_msg_id' },
  { prop: 'importance', column: 'importance', kind: 'number' },
  { prop: 'keywords', column: 'keywords', kind: 'json' },
  { prop: 'period', column: 'period', kind: 'json' },
  { prop: 'createdAt', column: 'created_at', required: true },
], { orderBy: 'created_at ASC' });

// ── 角色主数据 ────────────────────────────────────────────────
export const characterStore = new ColumnarStore<Character>(db, 'characters', [
  { prop: 'id', column: 'id', required: true },
  { prop: 'name', column: 'name', required: true },
  { prop: 'avatar', column: 'avatar' },
  { prop: 'tags', column: 'tags', kind: 'json' },
  { prop: 'group', column: 'group_name' },
  { prop: 'core', column: 'core', required: true, defaultValue: '' },
  { prop: 'persona', column: 'persona' },
  { prop: 'description', column: 'description' },
  { prop: 'sample', column: 'sample' },
  { prop: 'timezone', column: 'timezone' },
  { prop: 'apiPresetId', column: 'api_preset_id' },
  { prop: 'isFavorite', column: 'is_favorite', kind: 'boolean', defaultValue: false },
  { prop: 'isBlacklisted', column: 'is_blacklisted', kind: 'boolean', defaultValue: false },
  { prop: 'createdAt', column: 'created_at', required: true },
  { prop: 'updatedAt', column: 'updated_at' },
], { orderBy: 'created_at ASC' });
export const charStatStore  = new SqliteStore<CharStats>(db, 'char_stats');
export const statDefStore   = new SqliteStore<any>(db, 'stat_defs');
export const lifeStore      = new SqliteStore<LifeLog>(db, 'life');

// ── 角色附属数据 ──────────────────────────────────────────────
export const itemStore      = new SqliteStore<Item>(db, 'items');
export const timelineStore  = new SqliteStore<TimelineEvent>(db, 'timeline');
export const skillStore     = new SqliteStore<Skill>(db, 'skills');
export const relationStore  = new SqliteStore<Relation>(db, 'relations');
export const memoryStore = new ColumnarStore<Memory>(db, 'memories', [
  { prop: 'id', column: 'id', required: true },
  { prop: 'charId', column: 'char_id' },
  { prop: 'content', column: 'content', required: true, defaultValue: '' },
  { prop: 'text', column: 'text_alias' },
  { prop: 'type', column: 'type' },
  { prop: 'category', column: 'category' },
  { prop: 'source', column: 'source' },
  { prop: 'sourceId', column: 'source_id' },
  { prop: 'tags', column: 'tags', kind: 'json' },
  { prop: 'importance', column: 'importance', kind: 'number' },
  { prop: 'timestamp', column: 'timestamp' },
  { prop: 'createdAt', column: 'created_at', required: true },
], { orderBy: 'created_at ASC' });
export const dreamStore     = new SqliteStore<Dream>(db, 'dreams');

// ── 系统配置 ──────────────────────────────────────────────────
export const presetStore    = new SqliteStore<ApiPreset>(db, 'presets');
export const promptStore    = new SqliteStore<PromptPreset>(db, 'prompt_presets');

// ── 世界书 ────────────────────────────────────────────────────
// 已迁移到列式表（worldbooks / worldbook_entries / worldbook_event_entries）
// 通过 server/services/worldbook.ts 操作，不再使用 blob store

// ── 用户数据 ──────────────────────────────────────────────────
export const personaStore   = new SqliteStore<Persona>(db, 'personas');
export const mapStore       = new SqliteStore<any>(db, 'maps');

// ── 各 App 数据 ───────────────────────────────────────────────
export const calendarStore      = new SqliteStore<any>(db, 'calendar_events');
export const dafuStore          = new SqliteStore<any>(db, 'dafu_game');
export const diaryStore         = new SqliteStore<DiaryEntry>(db, 'diary');
export const suixiangCardStore  = new SqliteStore<any>(db, 'suixiang_cards');
export const suixiangEntryStore = new SqliteStore<any>(db, 'suixiang_entries');

// ── 全局活跃配置（单对象模式）────────────────────────────────
export const activeStore = new SqliteStore<Active>(db, 'active', {
  singleton: true,
  defaultValue: {
    id: 'singleton',
    primaryPresetId: null,
    activeMapId: null,
    featurePresets: { summaries: null, dafu: null, life: null, charSystem: null, dreams: null },
    featurePromptPresets: { summaries: null, life: null, charSystem: null },
    charSystemSettings: {
      extractionEnabled:        false,
      summaryToTimelineEnabled: true,
      statEventsEnabled:        true,
      lifeToTimelineEnabled:    true,
    },
    summarySettings: {
      periodicEnabled:    false,
      periodicInterval:   20,
      modeSummaryEnabled: false,
      dailyEnabled:       false,
    },
    summaryPrompts: {
      segment:  '',
      daily:    '',
      mode:     '',
      periodic: '',
    },
    contextBudget: 4000,
    timestampSettings: {
      sendUserTimestamp: true,
      sendCharTimestamp: false,
      syncConfirmed:     false,
      timestampFormat:   'bracket',
    },
  } as Active,
});
