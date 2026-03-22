import { FileStore } from './FileStore.js';

// ── 聊天 ─────────────────────────────────────────────────────────
export const messageStore   = new FileStore('chat/messages');
export const summaryStore   = new FileStore('chat/summaries');

// ── 角色主数据 ────────────────────────────────────────────────────
export const characterStore = new FileStore('chars/characters');
export const charStatStore  = new FileStore('chars/char_stats');   // 数值快照 { charId, stats:{} }
export const statDefStore   = new FileStore('chars/stat_defs');    // 属性定义
export const lifeStore      = new FileStore('chars/life');         // 生活日志

// ── 角色附属数据 ──────────────────────────────────────────────────
export const itemStore      = new FileStore('chardata/items');
export const timelineStore  = new FileStore('chardata/timeline');
export const skillStore     = new FileStore('chardata/skills');
export const relationStore  = new FileStore('chardata/relations');
export const memoryStore    = new FileStore('chardata/memories');
export const dreamStore     = new FileStore('chardata/dreams');

// ── 系统配置 ──────────────────────────────────────────────────────
export const presetStore    = new FileStore('system/presets');
export const promptStore    = new FileStore('system/prompt_presets');

// ── 世界书 ────────────────────────────────────────────────────────
export const wbBookStore    = new FileStore('worldbook/wb_books');
export const wbEntryStore   = new FileStore('worldbook/wb_entries');

// ── 用户数据 ──────────────────────────────────────────────────────
export const personaStore   = new FileStore('user/personas');
export const mapStore       = new FileStore('user/maps');

// ── 各 App 数据 ───────────────────────────────────────────────────
export const calendarStore      = new FileStore('apps/calendar_events');
export const dafuStore          = new FileStore('apps/dafu_game');
export const diaryStore         = new FileStore('apps/diary');
export const suixiangCardStore  = new FileStore('apps/suixiang_cards');
export const suixiangEntryStore = new FileStore('apps/suixiang_entries');

// ── 全局活跃配置（单对象模式）────────────────────────────────────
export const activeStore    = new FileStore('system/active', {
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
});
