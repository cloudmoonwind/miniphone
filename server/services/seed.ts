/**
 * 种子数据服务 — 为角色注入新数值/事件系统的示例数据
 *
 * 包含 5 个数值（含阶段 + 规则）、6 个事件（含标签 + 连接）、5 条世界状态。
 * 幂等：已有同 variableName 的数值或同 id 的事件则跳过。
 */

import * as valSvc from './values.js';
import * as evtSvc from './events.js';
import { getDrizzle } from '../db/database.js';
import { worldState } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { characterStore } from '../storage/index.js';

// ── 类型 ──────────────────────────────────────────────────────

interface SeedValueDef {
  variableName: string;
  name: string;
  category: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  stages: Array<{
    rangeMin: number;
    rangeMax: number;
    stageName: string;
    description: string;
    promptSnippet: string;
  }>;
  rules: Array<{
    rangeMin?: number;
    rangeMax?: number;
    triggerOn: string;
    operation: string;
    amount: number;
  }>;
}

interface SeedEventDef {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  probability: number;
  repeatable: number;
  maxTriggers?: number;
  unlockConditions?: string;
  triggerConditions?: string;
  effects?: string;
  cooldownType?: string;
  cooldownValue?: number;
  tags: Array<{ tagType: string; tagValue: string }>;
}

// ── 数值定义 ──────────────────────────────────────────────────

const VALUE_DEFS: SeedValueDef[] = [
  {
    variableName: 'affection', name: '好感度', category: 'relation',
    currentValue: 50, minValue: 0, maxValue: 100,
    stages: [
      { rangeMin: 0, rangeMax: 20, stageName: '陌生',
        description: '对你保持距离，态度冷淡',
        promptSnippet: '对用户态度冷淡，保持社交距离，不愿透露个人信息，回答简短敷衍' },
      { rangeMin: 20, rangeMax: 50, stageName: '认识',
        description: '愿意交谈，态度礼貌',
        promptSnippet: '对用户态度礼貌，愿意简单交流，偶尔微笑，但不会主动分享私事' },
      { rangeMin: 50, rangeMax: 80, stageName: '朋友',
        description: '态度温和，愿意分享',
        promptSnippet: '对用户态度温和亲切，愿意分享日常和心事，会开玩笑，偶尔主动找话题' },
      { rangeMin: 80, rangeMax: 100, stageName: '亲密',
        description: '非常热情，会主动关心',
        promptSnippet: '对用户非常热情，会主动关心嘘寒问暖，分享深层想法，语气中带着依赖和信任' },
    ],
    rules: [
      { rangeMin: 0, rangeMax: 20, triggerOn: 'chat_end', operation: 'add', amount: 3 },
      { rangeMin: 20, rangeMax: 50, triggerOn: 'chat_end', operation: 'add', amount: 2 },
      { rangeMin: 50, rangeMax: 80, triggerOn: 'chat_end', operation: 'add', amount: 1 },
      { rangeMin: 80, rangeMax: 100, triggerOn: 'chat_end', operation: 'add', amount: 0.5 },
      { triggerOn: 'time_pass', operation: 'add', amount: -0.5 },
    ],
  },
  {
    variableName: 'mood', name: '心情', category: 'emotion',
    currentValue: 70, minValue: 0, maxValue: 100,
    stages: [
      { rangeMin: 0, rangeMax: 30, stageName: '低落',
        description: '情绪低沉，不太想说话',
        promptSnippet: '情绪低落，说话气无力，不愿多聊，偶尔叹气，对什么都提不起兴趣' },
      { rangeMin: 30, rangeMax: 60, stageName: '平静',
        description: '心情平稳，正常状态',
        promptSnippet: '心情平静，正常交流，语气平和，不特别高兴也不特别低落' },
      { rangeMin: 60, rangeMax: 85, stageName: '愉快',
        description: '心情不错，容易笑',
        promptSnippet: '心情愉快，说话带笑意，语气轻快活泼，愿意聊更多话题' },
      { rangeMin: 85, rangeMax: 100, stageName: '兴奋',
        description: '非常开心，精力充沛',
        promptSnippet: '心情极好，兴奋地分享各种事情，语气热烈，笑声不断，充满感染力' },
    ],
    rules: [
      { rangeMin: 0, rangeMax: 60, triggerOn: 'chat_end', operation: 'add', amount: 2 },
      { rangeMin: 60, rangeMax: 100, triggerOn: 'chat_end', operation: 'add', amount: 1 },
      { triggerOn: 'time_pass', operation: 'add', amount: -1 },
    ],
  },
  {
    variableName: 'energy', name: '精力', category: 'status',
    currentValue: 80, minValue: 0, maxValue: 100,
    stages: [
      { rangeMin: 0, rangeMax: 25, stageName: '疲惫',
        description: '非常累，急需休息',
        promptSnippet: '非常疲惫，说话有气无力，经常打哈欠，可能会走神，希望早点结束对话去休息' },
      { rangeMin: 25, rangeMax: 50, stageName: '倦怠',
        description: '有点累，但能坚持',
        promptSnippet: '有些倦意，偶尔走神，回复速度变慢，但还是愿意聊天' },
      { rangeMin: 50, rangeMax: 75, stageName: '正常',
        description: '精力正常',
        promptSnippet: '精力正常，能正常交流和思考，状态良好' },
      { rangeMin: 75, rangeMax: 100, stageName: '充沛',
        description: '精力充沛，很有活力',
        promptSnippet: '精力充沛，反应敏捷，话多且思维活跃，愿意尝试新事物' },
    ],
    rules: [
      { triggerOn: 'chat_end', operation: 'add', amount: -2 },
      { rangeMin: 0, rangeMax: 75, triggerOn: 'time_pass', operation: 'add', amount: 5 },
    ],
  },
  {
    variableName: 'stress', name: '压力', category: 'emotion',
    currentValue: 20, minValue: 0, maxValue: 100,
    stages: [
      { rangeMin: 0, rangeMax: 25, stageName: '放松',
        description: '没什么压力，很放松',
        promptSnippet: '状态轻松，心态开放，乐于闲聊和开玩笑' },
      { rangeMin: 25, rangeMax: 50, stageName: '正常',
        description: '有些事情要操心',
        promptSnippet: '有一些在意的事，偶尔会提到烦恼，但整体还好' },
      { rangeMin: 50, rangeMax: 75, stageName: '紧张',
        description: '压力较大，容易焦虑',
        promptSnippet: '明显感到压力，语气中带着焦虑，容易急躁，可能会突然沉默或转移话题' },
      { rangeMin: 75, rangeMax: 100, stageName: '崩溃',
        description: '压力到极限，情绪不稳',
        promptSnippet: '压力到达极限，情绪不稳定，可能突然哭泣或发火，需要被安慰和理解' },
    ],
    rules: [
      { rangeMin: 25, rangeMax: 100, triggerOn: 'chat_end', operation: 'add', amount: -1 },
      { rangeMin: 0, rangeMax: 75, triggerOn: 'time_pass', operation: 'add', amount: 2 },
    ],
  },
  {
    variableName: 'trust', name: '信任', category: 'relation',
    currentValue: 40, minValue: 0, maxValue: 100,
    stages: [
      { rangeMin: 0, rangeMax: 30, stageName: '警惕',
        description: '不太信任你',
        promptSnippet: '对用户保持警惕，不会分享真实想法，说话有所保留，可能会试探用户的意图' },
      { rangeMin: 30, rangeMax: 60, stageName: '中立',
        description: '基本信任',
        promptSnippet: '对用户有基本的信任，愿意正常交流，但涉及敏感话题时会犹豫' },
      { rangeMin: 60, rangeMax: 85, stageName: '信赖',
        description: '值得信赖',
        promptSnippet: '信任用户，愿意分享心事和秘密，会在困难时寻求用户的意见和帮助' },
      { rangeMin: 85, rangeMax: 100, stageName: '托付',
        description: '完全信任',
        promptSnippet: '完全信任用户，愿意把最脆弱的一面展现出来，会毫无保留地倾诉' },
    ],
    rules: [
      { rangeMin: 0, rangeMax: 60, triggerOn: 'chat_end', operation: 'add', amount: 1 },
      { rangeMin: 60, rangeMax: 100, triggerOn: 'chat_end', operation: 'add', amount: 0.5 },
    ],
  },
];

// ── 事件定义 ──────────────────────────────────────────────────

const EVENT_DEFS: SeedEventDef[] = [
  {
    id: 'evt_first_meeting', name: '初次相遇',
    description: '命运的第一次安排，从这里开始一切故事',
    status: 'pending', priority: 10, probability: 100, repeatable: 0,
    effects: JSON.stringify([
      { type: 'inject', content: '角色注意到了你的存在，好奇地打量着你。一种微妙的感觉在空气中弥漫开来...', position: 'after_char', durationType: 'turns', durationValue: 3 },
      { type: 'modify_value', target: 'affection', operation: 'add', amount: 5 },
    ]),
    tags: [{ tagType: 'line', tagValue: '主线' }, { tagType: 'category', tagValue: '情感' }],
  },
  {
    id: 'evt_share_secret', name: '分享秘密',
    description: '信任到达一定程度后，角色愿意分享一个秘密',
    status: 'locked', priority: 5, probability: 100, repeatable: 0,
    unlockConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'event', target: 'evt_first_meeting', status: 'completed' },
      ]}],
    }),
    triggerConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'value', target: 'trust', operator: '>=', value: 60 },
      ]}],
    }),
    effects: JSON.stringify([
      { type: 'inject', content: '角色犹豫了一下，低下头轻声说："其实...有件事我一直没告诉别人。" 似乎决定对你敞开心扉。', position: 'after_char', durationType: 'turns', durationValue: 5 },
      { type: 'modify_value', target: 'trust', operation: 'add', amount: 10 },
      { type: 'set_flag', target: 'secret_shared', value: true },
    ]),
    tags: [{ tagType: 'line', tagValue: '主线' }, { tagType: 'category', tagValue: '情感' }],
  },
  {
    id: 'evt_first_date', name: '第一次约会',
    description: '关系进展到一定程度后的第一次正式约会',
    status: 'locked', priority: 8, probability: 100, repeatable: 0,
    unlockConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'event', target: 'evt_share_secret', status: 'completed' },
      ]}],
    }),
    triggerConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'value', target: 'affection', operator: '>=', value: 60 },
        { type: 'time', value: 'evening' },
      ]}],
    }),
    effects: JSON.stringify([
      { type: 'inject', content: '角色今天打扮得比平时用心。"那个...今晚有空吗？想去一个很好看的地方。" 脸颊微微泛红。', position: 'after_char', durationType: 'turns', durationValue: 8 },
      { type: 'modify_value', target: 'affection', operation: 'add', amount: 15 },
      { type: 'modify_value', target: 'mood', operation: 'set', amount: 90 },
    ]),
    tags: [{ tagType: 'line', tagValue: '主线' }, { tagType: 'category', tagValue: '情感' }, { tagType: 'chapter', tagValue: '第一章' }],
  },
  {
    id: 'evt_confession', name: '表白时机',
    description: '好感度到达巅峰，角色鼓起勇气表白',
    status: 'locked', priority: 10, probability: 100, repeatable: 0,
    unlockConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'event', target: 'evt_first_date', status: 'completed' },
      ]}],
    }),
    triggerConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'value', target: 'affection', operator: '>=', value: 80 },
        { type: 'value', target: 'mood', operator: '>=', value: 60 },
      ]}],
    }),
    effects: JSON.stringify([
      { type: 'inject', content: '角色深吸一口气，认真地看着你的眼睛。"我想了很久...我觉得我应该告诉你。" 心跳声仿佛都能听见。', position: 'after_char', durationType: 'permanent' },
      { type: 'modify_value', target: 'affection', operation: 'set', amount: 95 },
      { type: 'set_flag', target: 'confessed', value: true },
    ]),
    tags: [{ tagType: 'line', tagValue: '主线' }, { tagType: 'chapter', tagValue: '第一章' }],
  },
  {
    id: 'evt_rainy_encounter', name: '雨天偶遇',
    description: '下雨天的随机邂逅，增加好感和心情',
    status: 'pending', priority: 3, probability: 30, repeatable: 1,
    cooldownType: 'turns', cooldownValue: 5,
    triggerConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'weather', value: 'rain' },
      ]}],
    }),
    effects: JSON.stringify([
      { type: 'inject', content: '突然下起了雨。角色没有带伞，淋着雨朝你跑来。"能...能借我躲一下吗？" 雨水顺着发丝滑落。', position: 'after_char', durationType: 'turns', durationValue: 3 },
      { type: 'modify_value', target: 'affection', operation: 'add', amount: 5 },
      { type: 'modify_value', target: 'mood', operation: 'add', amount: 10 },
    ]),
    tags: [{ tagType: 'category', tagValue: '日常' }],
  },
  {
    id: 'evt_birthday_surprise', name: '生日惊喜',
    description: '角色为你准备的生日惊喜（需要高好感度解锁）',
    status: 'locked', priority: 7, probability: 100, repeatable: 0,
    unlockConditions: JSON.stringify({
      groups: [{ logic: 'and', conditions: [
        { type: 'value', target: 'affection', operator: '>=', value: 50 },
      ]}],
    }),
    effects: JSON.stringify([
      { type: 'inject', content: '角色偷偷准备了一份礼物，藏在身后。"闭上眼睛！不许偷看！" 声音里藏不住的兴奋和紧张。', position: 'after_char', durationType: 'turns', durationValue: 5 },
      { type: 'modify_value', target: 'mood', operation: 'set', amount: 95 },
      { type: 'modify_value', target: 'affection', operation: 'add', amount: 10 },
    ]),
    tags: [{ tagType: 'category', tagValue: '特殊' }],
  },
];

// ── 事件连接定义 ──────────────────────────────────────────────

const CONNECTION_DEFS = [
  { fromEventId: 'evt_first_meeting', toEventId: 'evt_share_secret', relationType: 'next' },
  { fromEventId: 'evt_share_secret', toEventId: 'evt_first_date', relationType: 'next' },
  { fromEventId: 'evt_first_date', toEventId: 'evt_confession', relationType: 'next' },
  { fromEventId: 'evt_first_meeting', toEventId: 'evt_rainy_encounter', relationType: 'branch' },
];

// ── 世界状态定义 ──────────────────────────────────────────────

const WORLD_STATE_DEFS = [
  { key: 'weather', value: 'sunny' },
  { key: 'location', value: 'school' },
  { key: 'time_period', value: 'afternoon' },
  { key: 'season', value: 'spring' },
  { key: 'day_type', value: 'weekday' },
];

// ── 种子函数 ──────────────────────────────────────────────────

export interface SeedResult {
  values: number;
  stages: number;
  rules: number;
  events: number;
  tags: number;
  connections: number;
  worldState: number;
}

/**
 * 为角色注入完整的示例数值和事件数据
 * 幂等：已存在的数据会跳过
 */
export function seedValueEventData(characterId: string): SeedResult {
  const result: SeedResult = { values: 0, stages: 0, rules: 0, events: 0, tags: 0, connections: 0, worldState: 0 };

  // ── 数值 + 阶段 + 规则 ──
  for (const def of VALUE_DEFS) {
    const existing = valSvc.getValueByVariable(characterId, def.variableName);
    if (existing) continue;

    const val = valSvc.createValue({
      characterId,
      category: def.category,
      name: def.name,
      variableName: def.variableName,
      currentValue: def.currentValue,
      minValue: def.minValue,
      maxValue: def.maxValue,
    });
    result.values++;

    // 阶段
    for (const s of def.stages) {
      valSvc.createStage({ valueId: val.id, ...s });
      result.stages++;
    }

    // 规则
    for (const r of def.rules) {
      valSvc.createRule({ valueId: val.id, ...r });
      result.rules++;
    }
  }

  // ── 事件 + 标签 ──
  // 取角色 ID 末 4 位作短标识，让事件 ID 每角色唯一
  const suffix = characterId.slice(-4);
  const eid = (base: string) => `${base}_${suffix}`;

  for (const def of EVENT_DEFS) {
    const realId = eid(def.id);
    const existing = evtSvc.getEventById(realId);
    if (existing) continue;

    const { tags, id, unlockConditions, triggerConditions, ...rest } = def;
    // 替换条件 JSON 中引用的事件 ID
    const fixRefs = (json?: string) => {
      if (!json) return json;
      let s = json;
      for (const d of EVENT_DEFS) s = s.replaceAll(d.id, eid(d.id));
      return s;
    };
    evtSvc.createEvent({
      ...rest, id: realId, characterId,
      unlockConditions: fixRefs(unlockConditions),
      triggerConditions: fixRefs(triggerConditions),
    });
    result.events++;

    for (const tag of tags) {
      evtSvc.createTag({ eventId: realId, ...tag });
      result.tags++;
    }
  }

  // ── 事件连接 ──
  const existingConns = evtSvc.getAllConnections(characterId);
  for (const conn of CONNECTION_DEFS) {
    const realFrom = eid(conn.fromEventId);
    const realTo = eid(conn.toEventId);
    const dup = existingConns.some(
      c => c.fromEventId === realFrom && c.toEventId === realTo
    );
    if (dup) continue;
    evtSvc.createConnection({ fromEventId: realFrom, toEventId: realTo, relationType: conn.relationType });
    result.connections++;
  }

  // ── 世界状态 ──
  const db = getDrizzle();
  const now = new Date().toISOString();
  for (const ws of WORLD_STATE_DEFS) {
    const existing = db.select().from(worldState)
      .where(eq(worldState.key, ws.key)).get();
    if (existing) continue;
    db.insert(worldState).values({ ...ws, updatedAt: now }).run();
    result.worldState++;
  }

  return result;
}

/**
 * 服务器启动时调用：为所有已有角色注入数值/事件数据 + 世界状态
 * 幂等，已有数据不会重复写入
 */
export async function seedAllCharacters(): Promise<void> {
  const chars = await characterStore.getAll();
  if (!chars.length) {
    console.log('[seed] 暂无角色，跳过数值/事件种子');
    return;
  }

  for (const char of chars) {
    const r = seedValueEventData(char.id);
    const total = r.values + r.events + r.worldState;
    if (total > 0) {
      console.log(`[seed] ${char.name || char.id}: +${r.values}值 +${r.stages}阶段 +${r.rules}规则 +${r.events}事件 +${r.tags}标签 +${r.connections}连接 +${r.worldState}世界状态`);
    }
  }
}
