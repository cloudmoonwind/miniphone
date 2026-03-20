import { FileStore } from './FileStore.js';

export const characterStore = new FileStore('characters');
export const messageStore   = new FileStore('messages');
export const summaryStore   = new FileStore('summaries');
export const memoryStore    = new FileStore('memories');
export const dreamStore     = new FileStore('dreams');
export const mapStore       = new FileStore('maps');
export const presetStore    = new FileStore('presets');
export const lifeStore      = new FileStore('life');
export const promptStore    = new FileStore('prompt_presets');
// 世界书：wb_books 存书（容器），wb_entries 存条目
export const wbBookStore    = new FileStore('wb_books');
export const wbEntryStore   = new FileStore('wb_entries');
// 道枢：角色数值属性定义 + 当前数值快照
export const statDefStore   = new FileStore('stat_defs');   // 属性定义（key/name/min/max/default）
export const charStatStore  = new FileStore('char_stats');  // 角色当前数值 { charId, stats:{} }
// 命格：用户马甲（角色扮演身份）
export const personaStore   = new FileStore('personas');    // 用户马甲 { name, avatar, description, color }
// 日记/随笔
export const diaryStore     = new FileStore('diary');       // 日记条目 { date, title, content, type, mood }
// Single-object store for active IDs
export const activeStore    = new FileStore('active', {
  primaryPresetId: null,
  activeMapId: null,
  featurePresets: { summaries: null, dafu: null, life: null },
  // 自动总结设置
  summarySettings: {
    periodicEnabled:  false,  // 按条数自动总结
    periodicInterval: 20,     // 每 N 条触发一次
    modeSummaryEnabled: false, // 切模式时自动总结前一段
    dailyEnabled:     false,  // 每天定时总结（需手动或前端触发）
  },
  // 总结提示词（各类型可自定义，空字符串时使用内置默认）
  summaryPrompts: {
    segment:  '',  // 段落总结（手动折叠段落时触发）
    daily:    '',  // 日总结（按日期查找里手动/自动触发）
    mode:     '',  // 模式段总结（切换线上/线下时触发）
    periodic: '',  // 按条数定期总结
  },
  // 时间戳设置
  timestampSettings: {
    sendUserTimestamp: true,          // 是否在发给 AI 的消息前注入 user 时间戳
    sendCharTimestamp: false,         // 是否注入 char 时间戳（预留，char 时间系统尚未完整实现）
    syncConfirmed:     false,         // user 时间与 char 时间是否确认同步（同步时不显示来源标签）
    timestampFormat:   'bracket',     // 'bracket'（[时间] 前缀嵌入content，通用）或 'metadata'（字段，Anthropic可读）
  },
});
