import { getDb } from '../db/database.js';
import { SqliteStore } from '../db/SqliteStore.js';
import type {
  Message, Summary, Character, CharStats, LifeLog,
  Item, TimelineEvent, Skill, Relation, Memory, Dream,
  ApiPreset, PromptPreset, Persona,
  DiaryEntry, Active,
} from '../types.js';

const db = getDb();

// ── 聊天 ─────────────────────────────────────────────────────
export const messageStore   = new SqliteStore<Message>(db, 'messages');
export const summaryStore   = new SqliteStore<Summary>(db, 'summaries');

// ── 角色主数据 ────────────────────────────────────────────────
export const characterStore = new SqliteStore<Character>(db, 'characters');
export const charStatStore  = new SqliteStore<CharStats>(db, 'char_stats');
export const statDefStore   = new SqliteStore<any>(db, 'stat_defs');
export const lifeStore      = new SqliteStore<LifeLog>(db, 'life');

// ── 角色附属数据 ──────────────────────────────────────────────
export const itemStore      = new SqliteStore<Item>(db, 'items');
export const timelineStore  = new SqliteStore<TimelineEvent>(db, 'timeline');
export const skillStore     = new SqliteStore<Skill>(db, 'skills');
export const relationStore  = new SqliteStore<Relation>(db, 'relations');
export const memoryStore    = new SqliteStore<Memory>(db, 'memories');
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
