// ============================================================
// miniphone / ICS — 全局类型定义
// 本文件是整个项目数据形状的单一事实来源（Single Source of Truth）。
// client 和 server 共享相同的数据语义；server 侧额外有 AI provider 接口。
// ============================================================

// ── 角色（Character）────────────────────────────────────────────────────────
export interface Character {
  id: string;
  name: string;
  avatar?: string;           // base64 data URL 或外链
  tags?: string[];
  group?: string;
  core: string;              // 角色核心设定（人物核心描述，必填）
  persona?: string;          // 人物描述（人设补充）
  sample?: string;           // 语料示例（对话风格示例）
  timezone?: string;         // "+08:00"，时间戳系统用
  apiPresetId?: string;      // 绑定的 API 预设 id
  isFavorite?: boolean;
  isBlacklisted?: boolean;
  createdAt: string;         // ISO8601
  updatedAt?: string;
}

// ── 聊天消息（Message）──────────────────────────────────────────────────────
export interface Message {
  id: string;
  charId: string;
  personaId?: string | null;
  sender: 'user' | 'character';
  content: string;
  mode: 'online' | 'offline';
  timestamp: string;         // ISO8601，DB 实际存储时间
  userTimestamp?: string;    // 用户设置的显示时间（元数据注入用）
  charTimestamp?: string | null;
  createdAt: string;
}

// ── API 预设（ApiPreset）────────────────────────────────────────────────────
export type ProviderType =
  | 'openai'
  | 'z-ai'
  | 'deepseek'
  | 'grok'
  | 'anthropic'
  | 'gemini'
  | string;                  // 允许自定义 provider key

export interface ApiPreset {
  id: string;
  name: string;
  provider: ProviderType;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: string;
  updatedAt?: string;
}

// ── 上下文预设（PromptPreset / 律令预设）────────────────────────────────────
// entryId 命名规则：
//   sys-*   系统内置槽（sys-char-core / sys-history / sys-syspre 等）
//   pent_*  用户自定义条目
export interface ContextItem {
  entryId: string;
  enabled: boolean;
  roleOverride?: 'system' | 'user' | 'assistant' | null;
  maxTokens?: number | null;
  historyCount?: number;      // 仅 sys-history 有效
  content?: string | null;   // editable 条目的内容
}

export type PromptPresetType = 'chat' | 'summary' | 'life' | 'charSystem';

export interface PromptPreset {
  id: string;
  name: string;
  /** DB 层级别区分符：'preset' = 上下文预设本体，'entry' = 自定义条目 */
  type?: string;
  presetType: PromptPresetType;
  contextItems: ContextItem[];
  createdAt: string;
  updatedAt?: string;
}

// ── 全局活跃配置（Active，单对象文件）──────────────────────────────────────
export interface Active {
  primaryPresetId: string | null;
  activeMapId: string | null;
  activePresetId?: string | null;
  activePersonaId?: string | null;
  activePromptPresetId?: string | null;
  featurePresets: {
    summaries: string | null;
    dafu: string | null;
    life: string | null;
    charSystem: string | null;
    dreams: string | null;
  };
  featurePromptPresets: {
    summaries: string | null;
    life: string | null;
    charSystem: string | null;
  };
  charSystemSettings: {
    extractionEnabled: boolean;
    summaryToTimelineEnabled: boolean;
    statEventsEnabled: boolean;
    lifeToTimelineEnabled: boolean;
  };
  summarySettings: {
    periodicEnabled: boolean;
    periodicInterval: number;
    modeSummaryEnabled: boolean;
    dailyEnabled: boolean;
  };
  summaryPrompts: {
    segment: string;
    daily: string;
    mode: string;
    periodic: string;
  };
  contextBudget: number;
  timestampSettings: {
    sendUserTimestamp: boolean;
    sendCharTimestamp: boolean;
    syncConfirmed: boolean;
    timestampFormat: 'bracket' | 'xml' | 'plain';
    hotTimestampEnabled?: boolean;
  };
}

// ── 世界书（WbBook / WbEntry）───────────────────────────────────────────────
export interface WbBook {
  id: string;
  name: string;
  charId: string | null;     // null = 全局世界书
  enabled: boolean;
  scanDepth?: number;
  createdAt: string;
}

export type ActivationMode =
  | 'always'
  | 'keyword'
  | 'event-random'
  | 'event-conditional';

export type InsertionPosition =
  | 'system-top'
  | 'system-bottom'
  | 'before-chat'
  | 'after-chat';

export interface WbEntry {
  id: string;
  bookId: string;
  name: string;
  content: string;
  enabled: boolean;
  activationMode: ActivationMode;
  insertionPosition: InsertionPosition;
  keywords: string[];
  weight?: number;
  priority?: number;
  noRecurse?: boolean;
  noFurtherRecurse?: boolean;
  condition?: { stat: string; op: string; value: number };
  eventConfig?: any;
  createdAt: string;
  updatedAt?: string;
}

// ── 角色属性数值（CharStats）────────────────────────────────────────────────
export interface StatDef {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface CharStats {
  charId: string;
  mood: number;
  energy: number;
  relationship: number;
  trust: number;
  stress: number;
  [key: string]: string | number;  // 支持自定义属性
}

// ── 命格马甲（Persona）──────────────────────────────────────────────────────
export interface Persona {
  id: string;
  name: string;
  content: string;
  color?: string;
  emoji?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ── 梦境（Dream）────────────────────────────────────────────────────────────
export interface Dream {
  id: string;
  charId: string;
  title: string;
  content: string;
  mood?: string;
  timestamp: string;         // ISO8601，梦境发生时间
  createdAt: string;
}

// ── 忆海记忆（Memory）───────────────────────────────────────────────────────
export interface Memory {
  id: string;
  charId: string;
  content: string;
  type?: string;
  importance?: number;       // 1~5
  timestamp?: string;
  createdAt: string;
}

// ── 聊天摘要（Summary）──────────────────────────────────────────────────────
export type SummaryType = 'segment' | 'daily' | 'mode' | 'periodic';

export interface Summary {
  id: string;
  charId: string;
  type: SummaryType;
  content: string;
  date?: string;             // 'YYYY-MM-DD'，日总结用
  messageIds?: string[];
  createdAt: string;
}

// ── 日记（DiaryEntry）───────────────────────────────────────────────────────
export interface DiaryEntry {
  id: string;
  date: string;              // 'YYYY-MM-DD'
  content: string;
  mood?: string;             // emoji
  createdAt: string;
  updatedAt?: string;
}

// ── 角色生活日志（LifeLog）──────────────────────────────────────────────────
export type LifePeriod = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface LifeLog {
  id: string;
  charId: string;
  content: string;
  period: LifePeriod;
  date: string;              // 'YYYY-MM-DD'
  createdAt: string;
}

// ── 角色附属数据 ─────────────────────────────────────────────────────────────
export interface Item {
  id: string;
  charId: string;
  name: string;
  description?: string;
  quantity?: number;
  category?: string;
  emoji?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  charId: string;
  title: string;
  content?: string;
  date?: string;             // 'YYYY-MM-DD'（旧字段）
  timestamp?: string;        // ISO8601（主要时间字段）
  type?: string;
  source?: string;           // 'manual' | 'summary' | 'life' | 'extraction'
  extractedSource?: string;
  linkedItemIds?: string[];
  linkedEventId?: string | null;
  linkedSummaryId?: string | null;
  linkedMessageIds?: string[];
  createdAt: string;
}

export interface Skill {
  id: string;
  charId: string;
  name: string;
  description?: string;
  level?: number;
  experience?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Relation {
  id: string;
  charId: string;
  targetName: string;
  relationType?: string;
  description?: string;
  closeness?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── 地图（Map）──────────────────────────────────────────────────────────────
export interface MapEntry {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt: string;
}

// ── 随笔（Suixiang）─────────────────────────────────────────────────────────
export interface SuixiangCard {
  id: string;
  title: string;
  color?: string;
  createdAt: string;
}

export interface SuixiangEntry {
  id: string;
  cardId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

// ── 日历事件（CalendarEvent）────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  date: string;              // 'YYYY-MM-DD'
  title: string;
  description?: string;
  color?: string;
  createdAt: string;
}

// ── 时光邮局（TimeCapsule）──────────────────────────────────────────────────
export interface TimeCapsule {
  id: string;
  title: string;
  content: string;
  openDate: string;          // 'YYYY-MM-DD'
  isOpened?: boolean;
  createdAt: string;
}

// ── AppContext 值类型 ────────────────────────────────────────────────────────
export interface AppContextValue {
  activeChar: Character | null;
  setActiveChar: (char: Character | null) => void;
  activePreset: ApiPreset | null;
  setActivePreset: (preset: ApiPreset | null) => void;
  wallpaper: string | null;
  updateWallpaper: (url: string | null) => void;
  recentChat: { char: Character; preview: string } | null;
  updateRecentChat: (char: Character, content: string) => void;
  navigate: (appId: string, params?: { char?: Character }) => void;
}

// ── EventBus 事件表（强类型）────────────────────────────────────────────────
export interface EventMap {
  'char:activated':     { char: Character | null };
  'char:updated':       { char: Character };
  'char:deleted':       { id: string };
  'chat:newMessage':    { charId: string; message: Message };
  'charSystem:updated': { charId: string };
  'preset:changed':     ApiPreset;
  'recentChat:update':  { char: Character; preview: string };
}

// ── 通用工具类型 ─────────────────────────────────────────────────────────────

/** 所有带 id 的资源基础形状 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

/** 分页结果（预留） */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API 错误响应 */
export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}
