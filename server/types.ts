// ============================================================
// miniphone / ICS — Server 端类型定义
// 数据实体类型与 client/src/types/index.ts 保持语义一致。
// 额外包含 server 专用接口：AI provider、FileStore 泛型等。
// ============================================================

// ── 重新导出（从 client 类型复制，保持同步）────────────────────────────────
// 注意：server 和 client 是两个独立 npm 包，不做跨包 import。
// 以下类型与 client/src/types/index.ts 保持一致，修改时两边同步。

export interface Character {
  id: string;
  name: string;
  avatar?: string;
  tags?: string[];
  group?: string;
  core: string;
  persona?: string;
  description?: string;   // 角色描述（部分路由使用）
  sample?: string;
  timezone?: string;
  apiPresetId?: string;
  isFavorite?: boolean;
  isBlacklisted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  charId: string;
  personaId?: string | null;
  sender: 'user' | 'character';
  role?: 'user' | 'assistant' | 'system'; // AI API role（部分路由用）
  content: string;
  mode: 'online' | 'offline';
  timestamp: string;
  userTimestamp?: string;
  charTimestamp?: string | null;
  createdAt: string;
}

export interface ApiPreset {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  params?: Record<string, any>;   // 扩展参数（如 top_p、stop 等）
  contextMode?: string;           // 'flexible' | 'strict'
  stream?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ContextItem {
  entryId: string;
  enabled: boolean;
  roleOverride?: 'system' | 'user' | 'assistant' | null;
  maxTokens?: number | null;
  historyCount?: number;
  content?: string | null;
}

export interface PromptPreset {
  id: string;
  name: string;
  /** DB 层级别区分符：'preset' = 上下文预设本体，'entry' = 自定义条目 */
  type?: string;
  presetType: 'chat' | 'summary' | 'life' | 'charSystem';
  feature?: string;         // 功能归属（'summaries' | 'life' | ...）
  description?: string;
  builtin?: boolean;
  prompts?: Record<string, string>;
  contextItems: ContextItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface Active {
  id: string;
  primaryPresetId: string | null;
  activeMapId: string | null;
  // 兼容旧字段（部分代码仍用 activePresetId / activePersonaId / activePromptPresetId）
  activePresetId?: string | null;
  activePersonaId?: string | null;
  activePromptPresetId?: string | null;
  userProfile?: string;           // 用户个人描述（personas 路由使用）
  featurePresets: Record<string, string | null>;
  featurePromptPresets: Record<string, string | null>;
  charSystemSettings: Record<string, boolean>;
  summarySettings: {
    periodicEnabled: boolean;
    periodicInterval: number;
    modeSummaryEnabled: boolean;
    dailyEnabled: boolean;
  };
  summaryPrompts: Record<string, string>;
  contextBudget: number;
  timestampSettings: {
    sendUserTimestamp: boolean;
    sendCharTimestamp: boolean;
    syncConfirmed: boolean;
    timestampFormat: string;
    hotTimestampEnabled?: boolean;
  };
}

// 世界书类型已迁移到 Drizzle schema（server/db/schema.ts）
// 通过 server/services/worldbook.ts 导出的 Worldbook / WbEntry / WbEventEntry 使用

export interface CharStats {
  id: string;
  charId: string;
  stats?: Record<string, number>;
  statusInfo?: Record<string, any>;
  [key: string]: any;
}

export interface Persona {
  id: string;
  name: string;
  content: string;
  description?: string;
  color?: string;
  emoji?: string;
  avatar?: string;
  isActive?: boolean;
  createdAt: string;
}

export interface Dream {
  id: string;
  charId: string;
  title: string;
  content: string;
  type?: string;
  mood?: string;
  importance?: number;
  interpreted?: boolean;
  interpretation?: string;
  summary?: string;
  skyX?: number;
  skyY?: number;
  timestamp: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  charId: string;
  content: string;
  text?: string;             // 部分路由使用 text 字段（与 content 同义）
  type?: string;
  category?: string;
  source?: string;
  sourceId?: string;
  tags?: string[];
  importance?: number;
  timestamp?: string;
  createdAt: string;
}

export interface Summary {
  id: string;
  charId: string;
  personaId?: string | null;
  type: string;
  level?: string;            // 摘要级别（'segment' | 'daily' 等）
  content: string;
  date?: string;
  messageIds?: string[];
  sourceIds?: string[];
  startMsgId?: string;
  importance?: number;
  keywords?: string[];
  period?: { from: string; to: string };
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  title?: string;
  type?: string;
  content: string;
  mood?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LifeLog {
  id: string;
  charId: string;
  content: string;
  period: string;
  date: string;
  type?: string;
  summary?: string;
  timeOfDay?: string;
  eventsUsed?: any[];
  statsSnapshot?: any;
  timestamp?: string;      // 兼容别名（部分路由使用）
  generatedAt?: string;    // AI 生成时间
  createdAt: string;
}

export interface Item {
  id: string;
  charId: string;
  name: string;
  description?: string;
  quantity?: number;
  category?: string;
  emoji?: string;
  source?: any;              // 来源（字符串 or { type, from } 对象）
  emotionalValue?: number;
  condition?: number;        // 物品状态值（0-100）
  status?: string;           // 'active' | 'lost' | ...
  location?: string;
  characterNotes?: string;
  linkedTimelineIds?: string[];
  obtainedAt?: string;
  extractedSource?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  charId: string;
  title: string;
  content?: string;
  date?: string;              // 'YYYY-MM-DD'（旧字段，向后兼容）
  timestamp?: string;         // ISO8601（实际使用的时间字段）
  type?: string;
  source?: string;
  extractedSource?: string;
  linkedItemIds?: string[];
  linkedEventId?: string | null;
  linkedSummaryId?: string | null;
  linkedLifeLogId?: string | null;
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
  category?: string;
  unlockedAt?: string;
  extractedSource?: string;
  createdAt: string;
}

export interface Relation {
  id: string;
  charId: string;
  targetName: string;
  targetEmoji?: string;
  relationType?: string;
  type?: string;
  description?: string;
  closeness?: number;
  notes?: string;
  extractedSource?: string;
  createdAt: string;
}

// ── AI Provider 接口（server 专用）─────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** AI provider 抽象接口 */
export interface AIProvider {
  chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
  chatCompletionStream(options: ChatCompletionOptions): AsyncIterable<string>;
  listModels(): Promise<string[]>;
}

export interface ProviderConfig {
  name: string;
  baseURL: string;
  defaultModel?: string;
  maxTemperature?: number;
  supportsStreaming?: boolean;
}

// ── FileStore 泛型接口（方便 routes 层使用）─────────────────────────────────
// FileStore 类本身在 storage/FileStore.ts 中定义，此处仅声明接口形状
export interface IFileStore<T extends { id: string }> {
  getAll(filter?: ((item: T) => boolean) | null): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  getObject(): Promise<T>;
  create(item: Partial<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  deleteMany(filter: (item: T) => boolean): Promise<number>;
  setObject(obj: T): Promise<T>;
}

// ── AI 日志记录（debug 模块用）──────────────────────────────────────────────
export interface AILogEntry {
  timestamp: string;
  charId?: string;
  preset?: string;
  messages: ChatMessage[];
  response?: string;
  error?: string;
  status?: number;
  duration?: number;
}
