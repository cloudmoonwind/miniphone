/**
 * promptPresets.js — 提示词预设管理服务
 *
 * 管理各功能（summaries / life / charSystem）的提示词预设。
 * 内置预设只读；用户可创建、修改、删除自定义预设。
 */

import { activeStore, promptStore } from '../storage/index.js';

// ── 内置预设 ────────────────────────────────────────────────────────────

export const BUILTIN_PROMPT_PRESETS = [
  {
    id: 'builtin-summaries-default',
    name: '默认总结预设',
    feature: 'summaries',
    description: '内置的对话总结提示词',
    builtin: true,
    prompts: {
      segment:  '你是一个对话总结助手。请用简洁的中文总结以下对话段的关键信息，重点记录情感变化、重要事件和关键细节，100字以内。',
      daily:    '你是一个对话总结助手。请用中文为以下对话生成一份日记式总结，记录当天的重要互动、情感变化和关键事件，200字以内。',
      mode:     '你是一个对话总结助手。请用简洁中文总结以下模式段（线上/线下）对话的关键内容，80字以内。',
      periodic: '你是一个对话总结助手。请用简洁中文总结以下这段对话的核心事件和情感状态，100字以内。',
    },
  },
  {
    id: 'builtin-life-default',
    name: '默认生活生成预设',
    feature: 'life',
    description: '内置的生活生成提示词',
    builtin: true,
    prompts: {
      systemExtension: '',
    },
  },
  {
    id: 'builtin-charsystem-default',
    name: '默认角色系统预设',
    feature: 'charSystem',
    description: '内置的角色系统提示词',
    builtin: true,
    prompts: {
      extraction: `你是一个数据提取助手。根据以下角色对话，提取角色的状态变化和新发生的事。

规则：
- 只提取对话中**明确提到**的内容，不要编造
- 如果没有值得提取的内容，返回空对象 {}
- 所有文本使用中文

返回严格 JSON（不要 markdown 代码块），结构：
{
  "status": {
    "moodColors": ["#hex1"],  // 仅在心情明显变化时提供，最多3色，用颜色表达情绪
    "location": "地点",       // 仅在提到位置变化时
    "statusDesc": "一句话描述当前状态",
    "innerThoughts": "角色内心独白"
  },
  "items": [
    {
      "name": "物品名",
      "emoji": "📦",
      "description": "描述",
      "category": "accessory|clothing|stationery|food|keepsake|tool|other",
      "source": { "type": "gift|bought|found|crafted", "from": "来源", "occasion": "场合" },
      "emotionalValue": 50
    }
  ],
  "timeline": [
    {
      "title": "事件标题",
      "content": "发生了什么",
      "type": "event|chat|item|milestone"
    }
  ],
  "relations": [
    {
      "targetName": "人名",
      "change": "closeness_delta",  // +5 或 -3 等
      "reason": "原因"
    }
  ],
  "skills": [
    {
      "name": "技能名",
      "category": "work|life|emotion",
      "reason": "为什么体现了这个技能"
    }
  ]
}

省略没有变化的字段。最简洁的输出。`,

      timelineEval: `你是一个角色生活记录助手。判断以下对话总结是否值得记录为角色时间线上的一个事件。

规则：
- 只有发生了值得记住的事（情感变化、重要对话、承诺、冲突、里程碑等）才值得记录
- 日常闲聊、重复话题、无实质内容的对话不值得记录
- 如果值得记录，给一个简短的事件标题（6-15字）

返回严格 JSON（无 markdown）：
{"record": true/false, "title": "事件标题（仅当record=true时）"}`,

      lifeExtract: `你是角色生活数据提取助手。分析以下角色日常生活内容，提取结构化数据。

只提取内容中**明确描述**的事，不要编造。
返回严格 JSON（无 markdown）：
{
  "timeline": [{"title": "事件标题(6-15字)", "content": "简述"}],
  "items": [{"name": "物品名", "emoji": "📦", "category": "other", "description": "描述"}],
  "skills": [{"name": "技能名", "category": "work|life|emotion"}]
}
省略空数组。如果没有值得提取的内容返回 {}`,
    },
  },
];

// 按 feature 索引内置预设（方便快速查找）
const BUILTIN_BY_FEATURE = {};
for (const p of BUILTIN_PROMPT_PRESETS) {
  BUILTIN_BY_FEATURE[p.feature] = p;
}

// ── 查询 ─────────────────────────────────────────────────────────────────

/**
 * 获取指定 feature 的活跃提示词预设。
 * 优先级：用户在 featurePromptPresets 中设定的 id
 *   → promptStore 中查找该 id
 *   → BUILTIN_PROMPT_PRESETS 中查找该 id
 *   → 该 feature 的内置默认预设
 */
export async function getActivePromptPreset(feature) {
  try {
    const active = await activeStore.getObject();
    const id = active?.featurePromptPresets?.[feature];

    if (id) {
      // 先查用户存储
      const userPreset = await promptStore.getById(id);
      if (userPreset) return userPreset;

      // 再查内置
      const builtin = BUILTIN_PROMPT_PRESETS.find(p => p.id === id);
      if (builtin) return builtin;
    }

    // 回退到该 feature 的内置默认
    return BUILTIN_BY_FEATURE[feature] || null;
  } catch {
    return BUILTIN_BY_FEATURE[feature] || null;
  }
}

/**
 * 获取指定 feature 活跃预设中的某个 prompt key 值。
 * 返回 null 表示该 key 不存在或为空字符串。
 */
export async function getPrompt(feature, key) {
  const preset = await getActivePromptPreset(feature);
  if (!preset) return null;
  const val = preset.prompts?.[key];
  return (val !== undefined && val !== null) ? val : null;
}
