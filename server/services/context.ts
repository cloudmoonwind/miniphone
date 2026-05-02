/**
 * context.js — 上下文组装服务
 *
 * 消息数组由「上下文」App 激活预设的 contextItems 顺序驱动。
 * 每个 contextItem 对应一个系统槽（sys-*）或自定义条目，
 * 按顺序展开为最终发给 AI 的 messages[]。
 *
 * 系统槽定义（必须与 client/src/apps/FilesApp.jsx 的 SYSTEM_SLOTS 保持同步）：
 *   sys-syspre      → 系统提示_前（可编辑，存于 item.content）
 *   sys-tools       → 工具（可编辑）
 *   sys-wbpre       → 世界书（前置，system-top 条目）
 *   sys-char-core   → char角色核心（char.core）
 *   sys-char-desc   → char角色描述（char.persona）
 *   sys-char-sample → char角色语料（char.sample）
 *   sys-user-desc   → user角色描述（命格马甲）
 *   sys-memories    → 对user的记忆
 *   sys-wbpost      → 世界书（后置，before-chat + system-bottom + after-chat）
 *   sys-scene       → 场景（可编辑）
 *   sys-life        → 近期生活（lifeStore 最近 3 条）
 *   sys-dreams      → 梦境（dreamStore 最近 3 条）
 *   sys-summaries   → chat history摘要
 *   sys-history     → chat history（特殊：展开为多条 user/assistant 消息）
 *   sys-syspost     → 系统提示_后（可编辑）
 */
import {
  characterStore, messageStore, summaryStore, memoryStore,
  activeStore, promptStore, personaStore, lifeStore, dreamStore,
} from '../storage/index.js';
import { getActivatedEntries } from './worldbook.js';
import { getInjectionsByCharacter } from './events.js';
import { getValuesByCharacter, getCurrentStage, seedDefaultVariables, getActiveRuleTexts } from './values.js';
import { resolvePlaceholders, type ResolveContext } from './placeholders.js';
import { traceSummary, traceDetail } from './trace.js';

const HOT_COUNT  = 20;
const WARM_COUNT = 5;
const MEMORY_MIN_IMPORTANCE = 7;

// ── Token 估算与截断 ──────────────────────────────────────────────────────────
// 中英混合约3字符/token，粗估够用
function estimateTokens(text) {
  return Math.ceil(text.length / 3);
}

function truncateToTokens(text, maxTokens) {
  if (!maxTokens || maxTokens <= 0) return text;
  if (estimateTokens(text) <= maxTokens) return text;
  const cutLen = Math.floor(maxTokens * 3 * 0.95); // 留5%余量避免边界抖动
  return text.slice(0, cutLen) + '\n…（已按 maxTokens 截断）';
}

// 消息合并分隔符
export const MSG_SEP = '\u001E';

// 系统槽 → blockType 映射（新槽位 + 老槽位向后兼容）
// skipPlaceholders=true 表示该槽内容是"系统生成的指令文本"，不应过占位符解析器
//   （sys-variables 含 {{val:...}} 字面量作为给 AI 看的格式说明；sys-mode 在 case 内部已显式调过解析器）
const SLOT_DEFS = {
  // ── 新槽位（v2，与 FilesApp SYSTEM_SLOTS 保持同步）────────────────────
  'sys-syspre':      { blockType: 'sys-pre',    defaultRole: 'system' }, // 系统提示_前（可编辑）
  'sys-tools':       { blockType: 'tools',      defaultRole: 'system' }, // 工具（可编辑）
  'sys-wbpre':       { blockType: 'wb-pre',     defaultRole: 'system' }, // 世界书（前置）
  'sys-char-core':   { blockType: 'char-core',  defaultRole: 'system' }, // char角色核心
  'sys-char-desc':   { blockType: 'char-desc',  defaultRole: 'system' }, // char角色描述
  'sys-char-sample': { blockType: 'char-sample',defaultRole: 'system' }, // char角色语料
  'sys-user-desc':   { blockType: 'user-desc',  defaultRole: 'system' }, // user角色描述
  'sys-memories':    { blockType: 'memories',   defaultRole: 'system' }, // 对user的记忆
  'sys-wbpost':      { blockType: 'wb-post',    defaultRole: 'system' }, // 世界书（后置）
  'sys-scene':       { blockType: 'scene',      defaultRole: 'system' }, // 场景（可编辑）
  'sys-life':        { blockType: 'life',        defaultRole: 'system' }, // 近期生活
  'sys-dreams':      { blockType: 'dreams',     defaultRole: 'system' }, // 梦境
  'sys-variables':   { blockType: 'variables',  defaultRole: 'system', skipPlaceholders: true }, // 变量系统状态（含给 AI 的格式指令）
  'sys-mode':        { blockType: 'mode',       defaultRole: 'system', skipPlaceholders: true }, // 对话模式提示（case 内手动解析当前模式模板）
  'sys-summaries':   { blockType: 'summaries',  defaultRole: 'system' }, // chat history摘要
  'sys-history':     { blockType: 'history',    defaultRole: null     }, // chat history（特殊：展开为多条）
  'sys-syspost':     { blockType: 'sys-post',   defaultRole: 'system' }, // 系统提示_后（可编辑）
  // ── 老槽位兼容（v1，避免已存预设失效）──────────────────────────────────
  'sys-persona':     { blockType: 'char-core',  defaultRole: 'system' }, // → char-core
  'sys-wbtop':       { blockType: 'wb-pre',     defaultRole: 'system' }, // → wb-pre
  'sys-userpersona': { blockType: 'user-desc',  defaultRole: 'system' }, // → user-desc
  'sys-wbbefore':    { blockType: 'wb-post',    defaultRole: 'system' }, // → wb-post
  'sys-wbafter':     { blockType: 'wb-post',    defaultRole: 'system' }, // → wb-post
  'sys-wbbottom':    { blockType: 'wb-post',    defaultRole: 'system' }, // → wb-post
};

// sys-mode 默认 content：JSON 映射，作者可在 FilesApp 编辑
const DEFAULT_MODE_TEMPLATES = JSON.stringify({
  online:  '（聊天气泡场景：短消息为主，口语化、自然停顿，避免长段叙事）',
  offline: '（长文叙事场景：每段 200-800 字，描写动作环境、内心活动）',
});

// 无预设时的默认顺序（使用新槽位结构）
// sys-mode 放在 sys-history 之后、sys-syspost 之前：
//   - 避免 mode 切换破坏 history 部分的 prompt 缓存
//   - 仍在 syspost 之前，作者写的"末尾系统提示"语境不被 mode 抢走
const DEFAULT_CONTEXT_ITEMS = [
  'sys-syspre', 'sys-tools', 'sys-wbpre',
  'sys-char-core', 'sys-char-desc', 'sys-char-sample',
  'sys-user-desc', 'sys-memories', 'sys-wbpost',
  'sys-scene', 'sys-life', 'sys-dreams',
  'sys-variables',
  'sys-summaries', 'sys-history', 'sys-mode', 'sys-syspost',
].map(id => ({
  entryId: id,
  enabled: id !== 'sys-tools' && id !== 'sys-char-sample',
  roleOverride: null,
  maxTokens: null,
  historyCount: id === 'sys-history' ? 20 : null,
  content: id === 'sys-mode' ? DEFAULT_MODE_TEMPLATES : null,
}));

// ── 时间戳格式化 ────────────────────────────────────────────────────────────
// hourOnly=true 时只输出到小时（用于线下模式，避免过度精确干扰叙事内容）
function formatTimestampForAI(isoStr, timezone = '+08:00', hourOnly = false) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  let offsetHours = 8;
  const m = String(timezone).match(/^([+-]?)(\d+)(?::(\d+))?/);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    offsetHours = sign * (parseInt(m[2]) + (parseInt(m[3] || '0') / 60));
  }
  const local = new Date(date.getTime() + offsetHours * 3_600_000);
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${local.getUTCFullYear()}-${pad(local.getUTCMonth()+1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}`;
  return hourOnly ? `${base}:xx` : `${base}:${pad(local.getUTCMinutes())}`;
}

/**
 * 组装发给 AI 的完整消息数组
 *
 * @param {string}  charId          角色 ID
 * @param {string}  personaId       用户马甲 ID（null = 不过滤）
 * @param {string}  newUserContent  新用户消息；null = 使用已存消息
 * @param {object}  options
 * @param {'flexible'|'strict'} options.contextMode
 * @param {'online'|'offline'|string} options.mode  当前对话模式（决定 sys-mode 槽注入哪段模板）
 */
export async function assembleMessages(charId, personaId, newUserContent, options: Record<string, any> = {}) {
  const { contextMode = 'flexible', mode: currentMode = null } = options;
  const contextTraceId = traceSummary('context', 'context.start', `assemble context (${contextMode})`, {
    charId,
    personaId,
    hasNewUserContent: !!newUserContent,
    contextMode,
    currentMode,
  });

  const char = await characterStore.getById(charId);
  if (!char) throw new Error(`Character not found: ${charId}`);

  // 全局设置
  const active = await activeStore.getObject().catch(() => ({} as any));
  const tsSettings   = active?.timestampSettings || {};
  const sendUserTs    = tsSettings.sendUserTimestamp ?? true;
  const hotTsEnabled  = tsSettings.hotTimestampEnabled ?? true; // 最近1小时逐条标注（可选）
  const charTz        = char.timezone || '+08:00';
  const injectTsHint  = sendUserTs;

  // 占位符解析上下文（一次构造、整次组装复用）。personaId 优先入参、否则取 active。
  const placeholderCtx: ResolveContext = {
    characterId: charId,
    personaId: personaId ?? active?.activePersonaId ?? null,
    mode: currentMode ?? null,
  };

  // 过滤条件
  const matchesContext = (item) =>
    item.charId === charId &&
    (!personaId || !item.personaId || item.personaId === personaId);

  // 并行加载所有数据源
  const [allMsgs, allSummaries, allMemories, allLife, allDreams] = await Promise.all([
    messageStore.getAll(matchesContext),
    summaryStore.getAll(matchesContext),
    memoryStore.getAll(m => m.charId === charId && m.importance >= MEMORY_MIN_IMPORTANCE),
    lifeStore.getAll(l => l.charId === charId).catch(() => []),
    dreamStore.getAll(d => d.charId === charId).catch(() => []),
  ]);
  traceDetail('context', 'context.sources', `${allMsgs.length} messages, ${allSummaries.length} summaries, ${allMemories.length} memories`, {
    messageCount: allMsgs.length,
    summaryCount: allSummaries.length,
    memoryCount: allMemories.length,
    lifeCount: allLife.length,
    dreamCount: allDreams.length,
  }, contextTraceId);

  // 近期生活（最近 3 条，从旧到新）
  const recentLife = [...allLife]
    .sort((a, b) => +new Date(a.generatedAt) - +new Date(b.generatedAt))
    .slice(-3);

  // 近期梦境（最近 3 条，从旧到新）
  const recentDreams = [...allDreams]
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
    .slice(-3);

  // 世界书条目（always / keyword 模式，支持级联激活）
  let activatedWb = { 'system-top': [], 'system-bottom': [], 'before-chat': [], 'after-chat': [] };
  try {
    const sortedMsgs = [...allMsgs].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const activated = getActivatedEntries(charId, sortedMsgs.map(m => ({ role: m.sender, content: m.content })));
    for (const e of activated) {
      const pos = e.position || 'system-bottom';
      if (!activatedWb[pos]) activatedWb['system-bottom'].push(e);
      else activatedWb[pos].push(e);
    }
    traceDetail('context', 'context.worldbook', `${activated.length} worldbook entries activated`, {
      activatedCount: activated.length,
      byPosition: Object.fromEntries(Object.entries(activatedWb).map(([pos, entries]) => [pos, entries.length])),
      entryIds: activated.map(e => e.id),
    }, contextTraceId);
  } catch { /* 世界书读取失败时静默降级 */ }

  // 活跃马甲内容
  let activePersonaContent = '';
  try {
    const pid = active?.activePersonaId || personaId;
    if (pid) {
      const persona = await personaStore.getById(pid);
      if (persona?.content) activePersonaContent = persona.content;
    }
  } catch {}

  // 加载 FilesApp 激活预设的 contextItems
  let contextItems: any = DEFAULT_CONTEXT_ITEMS;
  let customEntriesMap = {};
  try {
    const presetId = active?.activePromptPresetId;
    if (presetId) {
      const [allPresets, allEntries] = await Promise.all([
        promptStore.getAll(p => p.type === 'preset' && p.id === presetId),
        promptStore.getAll(e => e.type === 'entry'),
      ]);
      const preset = allPresets[0];
      if (preset?.contextItems?.length > 0) {
        contextItems = preset.contextItems;
        customEntriesMap = Object.fromEntries(allEntries.map(e => [e.id, e]));
      }
    }
  } catch { /* 预设读取失败时使用默认顺序 */ }

  // ── 历史消息构建器 ──────────────────────────────────────────────────────
  const sortedMsgs = [...allMsgs].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

  // 时区偏移量（毫秒），用于确定本地日期和2小时段
  let _tzOffsetHours = 8;
  const _tzMatch = String(charTz).match(/^([+-]?)(\d+)(?::(\d+))?/);
  if (_tzMatch) {
    const sign = _tzMatch[1] === '-' ? -1 : 1;
    _tzOffsetHours = sign * (parseInt(_tzMatch[2]) + (parseInt(_tzMatch[3] || '0') / 60));
  }
  const tzOffsetMs = _tzOffsetHours * 3_600_000;

  // 当前本地"今天"日期字符串 YYYY-MM-DD
  const _nowLocal = new Date(Date.now() + tzOffsetMs);
  const _pad = n => String(n).padStart(2, '0');
  const todayKey = `${_nowLocal.getUTCFullYear()}-${_pad(_nowLocal.getUTCMonth()+1)}-${_pad(_nowLocal.getUTCDate())}`;

  function buildHotMessages(count) {
    const hot = sortedMsgs.slice(-count);

    // "热区"：最近3条 user 层 + 最近3条 char 层（层 = 一条 DB 记录，可能含 MSG_SEP 合并的多短消息）
    const userMsgs = sortedMsgs.filter(m => m.sender === 'user');
    const charMsgs = sortedMsgs.filter(m => m.sender !== 'user');
    const hotIds = new Set([
      ...userMsgs.slice(-3).map(m => m.id),
      ...charMsgs.slice(-3).map(m => m.id),
    ]);

    let lastMarkedDay    = null; // 已打标的最后一个日期 key (YYYY-MM-DD)
    let lastMarkedBucket = null; // 已打标的最后一个2小时段 key (YYYY-MM-DD-H)

    const result = [];

    for (const m of hot) {
      const layers = m.content.includes(MSG_SEP)
        ? m.content.split(MSG_SEP).filter(Boolean)
        : [m.content];

      const role   = m.sender === 'user' ? 'user' : 'assistant';
      const ts     = m.userTimestamp || m.timestamp;
      const isHot  = hotIds.has(m.id);

      let metaTs = null;

      if (sendUserTs && ts) {
        const tsMs    = new Date(ts).getTime();
        const tsLocal = new Date(tsMs + tzOffsetMs);
        const dayKey  = `${tsLocal.getUTCFullYear()}-${_pad(tsLocal.getUTCMonth()+1)}-${_pad(tsLocal.getUTCDate())}`;
        const isToday = dayKey === todayKey;

        if (m.mode === 'offline') {
          // 线下消息：只按自然日打日期标记，不打精确时间
          if (dayKey !== lastMarkedDay) {
            metaTs = dayKey;
            lastMarkedDay = dayKey;
          }
        } else if (isHot) {
          // 线上热区（user/char各最近3层）：每层打精确时间
          metaTs = formatTimestampForAI(ts, charTz, false);
        } else if (!isToday) {
          // 今天之前：每个自然日仅在第一条记录打日期
          if (dayKey !== lastMarkedDay) {
            metaTs = dayKey;
            lastMarkedDay = dayKey;
          }
        } else {
          // 今天但不在热区：每2小时段仅打一次
          const bucketHour = Math.floor(tsLocal.getUTCHours() / 2) * 2;
          const bucketKey  = `${dayKey}-${bucketHour}`;
          if (bucketKey !== lastMarkedBucket) {
            metaTs = formatTimestampForAI(ts, charTz, false);
            lastMarkedBucket = bucketKey;
          }
        }
      }

      // 时间戳作为独立 user 消息，插在对话消息之前（避免嵌入 content 干扰模型）
      if (metaTs) {
        result.push({ role: 'user', content: `<meta timestamp="${metaTs}"/>` });
      }

      result.push({ role, content: layers.join('\n') });
    }

    return result;
  }

  // 近期摘要（从旧到新）
  const warmSummaries = [...allSummaries]
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .slice(-WARM_COUNT);

  // ── 世界书文本构建助手 ───────────────────────────────────────────────────
  const wbText = (entries) =>
    entries.map(e => (e.memo ? `【${e.memo}】\n` : '') + (e.content || '')).filter(Boolean).join('\n\n');

  // ── 待注入内容（pending_injections） ────────────────────────────────────
  // 按 position 分组，待组装时插入对应位置
  const pendingInj = (() => {
    try { return getInjectionsByCharacter(charId); } catch { return []; }
  })();
  traceDetail('pending', 'pending.available', `${pendingInj.length} pending injections available`, {
    count: pendingInj.length,
    ids: pendingInj.map(inj => inj.id),
    byPosition: pendingInj.reduce((acc, inj) => {
      const pos = inj.position || 'status_section';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  }, contextTraceId);
  const injByPos: Record<string, string[]> = {};
  for (const inj of pendingInj) {
    const pos = inj.position || 'status_section';
    if (!injByPos[pos]) injByPos[pos] = [];
    injByPos[pos].push(inj.content);
  }
  const consumeInj = (pos: string): string | null => {
    const items = injByPos[pos];
    if (!items?.length) return null;
    const merged = items.join('\n');
    delete injByPos[pos];
    traceDetail('pending', 'pending.inject', `${items.length} injections inserted at ${pos}`, {
      position: pos,
      count: items.length,
      tokenEstimate: estimateTokens(merged),
    }, contextTraceId);
    return merged;
  };

  // ════ 按 contextItems 顺序构建 messages 数组 ════════════════════════════
  const messages = [];

  for (const item of contextItems) {
    if (!item.enabled) continue;

    const slotDef   = SLOT_DEFS[item.entryId];
    const customEntry = !slotDef ? customEntriesMap[item.entryId] : null;
    const blockType = slotDef?.blockType || null;
    const role      = item.roleOverride || slotDef?.defaultRole || customEntry?.role || 'system';

    // before_char 注入点：在 char-core 之前插入
    if (blockType === 'char-core') {
      const inj = consumeInj('before_char');
      if (inj) messages.push({ role: 'system', content: resolvePlaceholders(inj, placeholderCtx) });
    }

    // before_history 注入点：在 history 之前插入
    if (blockType === 'history') {
      const inj = consumeInj('before_history');
      if (inj) messages.push({ role: 'system', content: resolvePlaceholders(inj, placeholderCtx) });
    }

    // status_section 注入点：在 scene/life 之前插入
    if (blockType === 'scene' || blockType === 'life') {
      const inj = consumeInj('status_section');
      if (inj) { messages.push({ role: 'system', content: resolvePlaceholders(inj, placeholderCtx) }); }
    }

    // 特殊：history 展开为多条消息
    if (blockType === 'history') {
      const count = item.historyCount || HOT_COUNT;
      const histMsgs = buildHotMessages(count);
      if (item.maxTokens) {
        // 从最新往最旧累计 token，直到超限
        let tokens = 0;
        const filtered = [];
        for (let i = histMsgs.length - 1; i >= 0; i--) {
          const t = estimateTokens(histMsgs[i].content);
          if (tokens + t > item.maxTokens) break;
          tokens += t;
          filtered.unshift(histMsgs[i]);
        }
        messages.push(...filtered);
        traceDetail('context', 'context.slot', `${item.entryId} history ${filtered.length}/${histMsgs.length} messages`, {
          entryId: item.entryId,
          blockType,
          role,
          messageCount: filtered.length,
          originalMessageCount: histMsgs.length,
          truncated: filtered.length < histMsgs.length,
          maxTokens: item.maxTokens,
          tokenEstimate: tokens,
        }, contextTraceId);
      } else {
        messages.push(...histMsgs);
        traceDetail('context', 'context.slot', `${item.entryId} history ${histMsgs.length} messages`, {
          entryId: item.entryId,
          blockType,
          role,
          messageCount: histMsgs.length,
          tokenEstimate: histMsgs.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0),
        }, contextTraceId);
      }
      continue;
    }

    // 其他槽 → 解析为单条文本
    let content = '';
    switch (blockType) {
      // ── 新槽位 ─────────────────────────────────────────────────────────
      case 'sys-pre':
      case 'sys-post':
      case 'scene':
      case 'tools':
        // 可编辑槽：内容直接存在 contextItem.content 里
        content = item.content || '';
        break;

      case 'char-core': {
        // 角色核心：名字 + core + 时间戳说明（仅 chat 模式需要）
        const parts = [`你是${char.name}。`];
        if (char.core) parts.push(char.core);
        if (injectTsHint) parts.push('\n【消息时间标记说明】对话中会穿插 role=user 的独立 <meta timestamp="..."/> 消息，这是系统注入的时间元数据，表示其后消息的发送时间。你应利用这些时间信息感知对话时间线，但不要在回复中输出或引用 <meta> 标签本身。');
        content = parts.filter(Boolean).join('\n');
        break;
      }

      case 'char-desc':
        // 角色描述：persona 字段
        content = char.persona || '';
        break;

      case 'char-sample':
        // 角色语料：sample 字段（新字段，可能为空）
        content = char.sample || '';
        break;

      case 'user-desc':
        // user角色描述：激活的命格马甲内容
        content = activePersonaContent;
        break;

      case 'wb-pre':
        // 世界书前置：system-top 条目
        content = wbText(activatedWb['system-top']);
        break;

      case 'wb-post':
        // 世界书后置：before-chat + system-bottom + after-chat 条目
        content = [
          wbText(activatedWb['before-chat']),
          wbText(activatedWb['system-bottom']),
          wbText(activatedWb['after-chat']),
        ].filter(Boolean).join('\n\n');
        break;

      case 'memories':
        if (allMemories.length > 0)
          content = '【关于用户的重要记忆】\n' + allMemories.map(m => `- ${m.content}`).join('\n');
        break;

      case 'life':
        if (recentLife.length > 0) {
          content = '【近期生活】\n' + recentLife.map(l => {
            const date = l.period || l.generatedAt?.slice(0, 10) || '';
            const time = l.timeOfDay ? ({ morning:'上午', afternoon:'下午', evening:'傍晚', night:'深夜' }[l.timeOfDay] || l.timeOfDay) : '';
            return `${date}${time ? ' ' + time : ''}：${l.content}`;
          }).join('\n\n');
        }
        break;

      case 'dreams':
        if (recentDreams.length > 0) {
          content = '【近期梦境】\n' + recentDreams.map(d => {
            const date = d.timestamp?.slice(0, 10) || '';
            const title = d.title ? `《${d.title}》` : '';
            return `${date}${title}：${d.content || ''}`;
          }).join('\n\n');
        }
        break;

      case 'variables': {
        // 自动种seed情绪底色变量（幂等）
        try { seedDefaultVariables(charId); } catch {}
        const charVars = getValuesByCharacter(charId);
        if (charVars.length > 0) {
          // 从最新消息快照里取 emotion_state 字符串
          let emotionState: string | null = null;
          const msgsWithSnap = [...sortedMsgs].reverse().find(
            (m: any) => m.variableSnapshot?.emotion_state
          ) as any;
          if (msgsWithSnap) emotionState = msgsWithSnap.variableSnapshot.emotion_state;

          const lines: string[] = ['【当前变量状态】'];

          // 情绪底色三轴（若存在）
          const BASELINE_VARS = ['sanity', 'stability', 'intensity'];
          const baselines = charVars.filter(v => BASELINE_VARS.includes(v.variableName));
          if (baselines.length > 0) {
            lines.push('情绪底色：' + baselines.map(v => `${v.variableName}(${v.name}) ${v.currentValue}`).join(' | '));
          }

          // 当前情绪状态（来自上轮快照）
          if (emotionState) {
            lines.push(`当前情绪：${emotionState}`);
          }

          // 其余变量
          const others = charVars.filter(v => !BASELINE_VARS.includes(v.variableName));
          for (const v of others) {
            const stage = getCurrentStage(v.id);
            const stageText = stage?.stageName ? `（${stage.stageName}）` : '';
            lines.push(`${v.variableName}(${v.name})：${v.currentValue}${stageText}`);
          }

          // 情绪底色轴说明 + 格式指令
          lines.push('');
          lines.push('【情绪底色轴说明】三轴范围均为 -100~100：');
          lines.push('sanity（理智）：负值=理性崩溃混乱，正值=冷静清醒');
          lines.push('stability（稳定）：负值=情绪剧烈波动，正值=情绪稳定平静');
          lines.push('intensity（强度）：负值=麻木压抑低迷，正值=情绪强烈激越');

          // 当前范围匹配的规则文本注入
          try {
            const activeRules = getActiveRuleTexts(charId);
            if (activeRules.length > 0) {
              traceDetail('variables', 'variables.rules', `${activeRules.length} active variable rules injected`, {
                count: activeRules.length,
                rules: activeRules.map(r => ({
                  variableName: r.variableName,
                  name: r.name,
                  currentValue: r.currentValue,
                  ruleText: r.ruleText,
                })),
              }, contextTraceId);
              lines.push('');
              lines.push('【变量更新规则】以下是各变量当前值范围适用的更新规则（自然语言描述，决策变量变化时参考）：');
              for (const r of activeRules) {
                lines.push(`${r.variableName}（${r.name}，当前${r.currentValue}）：${r.ruleText}`);
              }
            }
          } catch {}

          lines.push('');
          lines.push('【输出协议】如本轮有变量变化或事件标记，在正文末尾空一行后附加 <sys> 块；没有任何变化时可省略整个块。结构：');
          lines.push('<sys>');
          lines.push('  <var>');
          lines.push('  变量名: 旧值→新值                       —— 数值更新（旧值需与当前值一致，±1 容忍）');
          lines.push('  变量名: 旧值→新值 | 原因: 简短说明      —— 可选附加原因');
          lines.push('  情绪: 情绪词1 X% | 情绪词2 Y%            —— 情绪快照，百分比之和≈100，选2~5个');
          lines.push('  </var>');
          lines.push('  <event>');
          lines.push('  事件ID: outcome                          —— 标记某事件结果（仅在剧情节点触达时使用）');
          lines.push('  事件ID: outcome | 原因: 简短说明');
          lines.push('  </event>');
          lines.push('</sys>');
          lines.push('约束：变量名用 variableName 或显示名都行；情绪行不支持 | 原因；<sys> 块不会展示给用户。');

          content = lines.join('\n');
        }
        break;
      }

      case 'mode': {
        // sys-mode 槽：item.content 是 JSON 映射 { online: "...", offline: "...", ... }
        // 按当前 mode 取对应模板，过解析器后注入。无 mode 或映射里没匹配的 mode → 跳过
        if (!currentMode) {
          traceDetail('context', 'context.mode.skip', 'no current mode provided', null, contextTraceId);
          break;
        }
        let modeMap: Record<string, string> | null = null;
        if (item.content && typeof item.content === 'string') {
          try { modeMap = JSON.parse(item.content); } catch { /* 留空 */ }
        } else if (item.content && typeof item.content === 'object') {
          modeMap = item.content as any;
        }
        if (!modeMap || typeof modeMap !== 'object') {
          traceDetail('context', 'context.mode.skip', 'sys-mode content not a JSON map', { content: item.content }, contextTraceId);
          break;
        }
        const template = modeMap[currentMode];
        if (typeof template !== 'string' || !template.trim()) {
          traceDetail('context', 'context.mode.skip', `mode "${currentMode}" not configured`, {
            currentMode,
            availableKeys: Object.keys(modeMap),
          }, contextTraceId);
          break;
        }
        content = resolvePlaceholders(template, placeholderCtx);
        traceDetail('context', 'context.mode.injected', `mode "${currentMode}" template injected`, {
          currentMode,
          tokenEstimate: estimateTokens(content),
        }, contextTraceId);
        break;
      }

      case 'summaries':
        if (warmSummaries.length > 0)
          content = '【近期互动摘要（从旧到新）】\n' + warmSummaries.map(s => s.content).join('\n');
        break;

      // ── 老槽位兼容（已在 SLOT_DEFS 重映射，理论上不会到这里，保底处理）──
      case 'persona': {
        const parts = [`你是${char.name}。`];
        if (char.core)    parts.push(char.core);
        if (char.persona) parts.push(char.persona);
        if (injectTsHint) parts.push('\n【消息时间标记说明】对话中会穿插 role=user 的独立 <meta timestamp="..."/> 消息，这是系统注入的时间元数据，表示其后消息的发送时间。你应利用这些时间信息感知对话时间线，但不要在回复中输出或引用 <meta> 标签本身。');
        content = parts.filter(Boolean).join('\n');
        break;
      }
      case 'wb-sys-top':
        content = wbText(activatedWb['system-top']);
        break;
      case 'wb-sys-bot':
        content = wbText(activatedWb['system-bottom']);
        break;
      case 'wb-before':
        content = wbText(activatedWb['before-chat']);
        break;
      case 'wb-after':
        content = wbText(activatedWb['after-chat']);
        break;
      case 'user-persona':
        content = activePersonaContent;
        break;

      default:
        content = customEntry?.content || '';
        break;
    }

    if (content.trim()) {
      // 占位符解析：slotDef.skipPlaceholders=true 的槽（如 sys-variables / sys-mode）是系统生成或已自行解析的内容，跳过统一出口的解析
      const skipResolve = (slotDef as any)?.skipPlaceholders === true;
      const resolved = skipResolve ? content : resolvePlaceholders(content, placeholderCtx);
      const finalContent = item.maxTokens ? truncateToTokens(resolved, item.maxTokens) : resolved;
      messages.push({ role, content: finalContent });
      traceDetail('context', 'context.slot', `${item.entryId} ${estimateTokens(finalContent)} tokens${finalContent !== content ? ' resolved/truncated' : ''}`, {
        entryId: item.entryId,
        blockType,
        role,
        tokenEstimate: estimateTokens(finalContent),
        originalTokenEstimate: estimateTokens(content),
        resolved: resolved !== content,
        truncated: finalContent !== resolved,
        maxTokens: item.maxTokens ?? null,
      }, contextTraceId);
    }

    // after_char 注入点：在 char-sample（或兜底 char-desc）之后插入
    if (blockType === 'char-sample' || blockType === 'char-desc') {
      const inj = consumeInj('after_char');
      if (inj) messages.push({ role: 'system', content: resolvePlaceholders(inj, placeholderCtx) });
    }
  }

  // 所有未消耗的注入（position 未匹配或 permanent 类型）→ 追加到最后的 system 块前
  const remaining = Object.values(injByPos).flat();
  if (remaining.length) {
    messages.push({ role: 'system', content: resolvePlaceholders(remaining.join('\n'), placeholderCtx) });
    traceDetail('pending', 'pending.remainingInjected', `${remaining.length} unmatched injections appended`, {
      count: remaining.length,
      positions: Object.keys(injByPos),
    }, contextTraceId);
  }

  // 若上下文以 assistant 结尾且无新用户消息，追加 (继续) 占位
  if (!newUserContent && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    messages.push({ role: 'user', content: '(继续)' });
  }

  if (newUserContent) {
    messages.push({ role: 'user', content: newUserContent });
  }

  // strict 模式：合并连续同角色消息
  let finalMessages = messages;
  if (contextMode === 'strict' && messages.length > 0) {
    finalMessages = [{ ...messages[0] }];
    for (let i = 1; i < messages.length; i++) {
      const last = finalMessages[finalMessages.length - 1];
      if (last.role === messages[i].role) {
        last.content += '\n' + messages[i].content;
      } else {
        finalMessages.push({ ...messages[i] });
      }
    }
  }

  traceSummary('context', 'context.done', `${finalMessages.length} messages assembled`, {
    mode: contextMode,
    messageCount: finalMessages.length,
    tokenEstimate: finalMessages.reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0),
    strictMerged: finalMessages.length !== messages.length,
  });

  return { messages: finalMessages, char };
}
