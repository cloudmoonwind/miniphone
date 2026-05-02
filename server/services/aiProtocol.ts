/**
 * AI 输出协议解析器（阶段 2）。
 *
 * 协议规范见 ICS_AI输出协议_v1.md。
 * 本模块是**纯解析层**：只把字符串拆成结构化对象，不连数据库、不做语义校验、不写库。
 * 解析结果由调用方（chat.ts）再交给 applyVarBlock / applyEventOutcomes 等应用层函数处理。
 *
 * 入口：parseAIOutput(content)
 *   → { cleanContent, varUpdates, emotion, events, diagnostics }
 *
 * 失败降级：
 *   - <sys> 块未闭合或子标签嵌套混乱：整段 <sys> 移除，trace 警告
 *   - 单行格式错：跳过该行，其他行继续
 *   - 未识别子标签：忽略该子标签，trace 警告
 */

import { traceSummary, traceDetail } from './trace.js';

// ── 类型 ─────────────────────────────────────────────────────

export interface ParsedVarUpdate {
  /** 原始变量名（可能是 variableName 或 displayName，应用层负责查找） */
  variableName: string;
  oldValue: number;
  newValue: number;
  reason?: string;
}

export interface ParsedEmotion {
  /** 情绪行原文（"情绪:" 之后的部分） */
  raw: string;
  /** 拆分后的 [{ word, pct }] */
  parts: Array<{ word: string; pct: number }>;
}

export interface ParsedEventOutcome {
  eventId: string;
  outcome: string;
  reason?: string;
}

export interface ParsedAIOutput {
  /** 移除 <sys> 块后的干净正文 */
  cleanContent: string;
  varUpdates: ParsedVarUpdate[];
  emotion: ParsedEmotion | null;
  events: ParsedEventOutcome[];
  diagnostics: {
    sysBlockFound: boolean;
    varBlockFound: boolean;
    eventBlockFound: boolean;
    /** 跳过的行（格式错） */
    skippedLines: Array<{ block: string; line: string; reason: string }>;
    /** 跳过的子标签（未识别或解析失败） */
    skippedSubBlocks: Array<{ name: string; reason: string }>;
  };
}

// ── 主入口 ───────────────────────────────────────────────────

export function parseAIOutput(content: string): ParsedAIOutput {
  const result: ParsedAIOutput = {
    cleanContent: content,
    varUpdates: [],
    emotion: null,
    events: [],
    diagnostics: {
      sysBlockFound: false,
      varBlockFound: false,
      eventBlockFound: false,
      skippedLines: [],
      skippedSubBlocks: [],
    },
  };

  if (!content) return result;

  const sys = extractSysBlock(content);
  if (!sys) return result;

  result.cleanContent = sys.cleanContent;
  result.diagnostics.sysBlockFound = true;

  if (sys.error) {
    traceSummary('aiProtocol', 'protocol.parse.failed', sys.error, { contentLength: content.length });
    return result;
  }

  // 遍历 <sys> 内的子标签（按出现顺序）
  for (const sub of iterateSubBlocks(sys.body)) {
    const tagLower = sub.name.toLowerCase();

    if (tagLower === 'var') {
      result.diagnostics.varBlockFound = true;
      parseVarBlockInto(sub.body, result);
    } else if (tagLower === 'event') {
      result.diagnostics.eventBlockFound = true;
      parseEventBlockInto(sub.body, result);
    } else {
      result.diagnostics.skippedSubBlocks.push({ name: sub.name, reason: 'unknown-subtag' });
      traceDetail('aiProtocol', 'protocol.subblock.unknown', `未识别子标签 <${sub.name}> 已忽略`, {
        name: sub.name,
        bodySnippet: sub.body.slice(0, 80),
      });
    }
  }

  traceSummary('aiProtocol', 'protocol.parse.done',
    `${result.varUpdates.length} vars, ${result.emotion ? 'emotion' : 'no-emotion'}, ${result.events.length} events`,
    {
      varCount: result.varUpdates.length,
      hasEmotion: !!result.emotion,
      eventCount: result.events.length,
      skippedLineCount: result.diagnostics.skippedLines.length,
      skippedSubBlockCount: result.diagnostics.skippedSubBlocks.length,
    });

  return result;
}

// ── <sys> 块提取 ─────────────────────────────────────────────

interface ExtractedSys {
  body: string;
  cleanContent: string;
  /** 非 null 表示提取出了 <sys> 但内部异常（如未闭合），整段忽略 */
  error: string | null;
}

/**
 * 提取最后一个 <sys>...</sys> 块（大小写不敏感）。
 * 返回 null 表示未发现 <sys> 块。
 * 返回 { error: ... } 表示发现起始标签但内部格式错。
 */
function extractSysBlock(content: string): ExtractedSys | null {
  // 大小写不敏感：直接用 /i 标志的非贪婪匹配
  const re = /<sys[^>]*>([\s\S]*?)<\/sys\s*>/gi;
  const matches = [...content.matchAll(re)];

  // 检测：有起始标签 <sys> 但没匹配到完整闭合
  const hasOpening = /<sys[^>]*>/i.test(content);

  if (matches.length === 0) {
    if (hasOpening) {
      // 起始标签存在但闭合不到 — 整段移除起始标签后的内容到结尾，记错
      const idx = content.search(/<sys[^>]*>/i);
      const cleanContent = content.slice(0, idx).trimEnd();
      return { body: '', cleanContent, error: '<sys> 起始标签存在但未找到闭合 </sys>' };
    }
    return null;
  }

  // 取最后一个 match（协议规定 <sys> 应在末尾）
  const last = matches[matches.length - 1];
  const body = last[1];
  // 把 <sys>...</sys> 整段从原文中移除（仅最后一个那段）
  const start = last.index!;
  const end = start + last[0].length;
  const cleanContent = (content.slice(0, start) + content.slice(end)).replace(/\n{3,}/g, '\n\n').trim();

  return { body, cleanContent, error: null };
}

// ── 子标签遍历 ───────────────────────────────────────────────

interface SubBlock {
  name: string;
  body: string;
}

/**
 * 按出现顺序遍历 <sys> 内的子标签。
 * 大小写不敏感、要求开闭标签同名（不区分大小写比较）。
 * 嵌套标签不支持，遇到嵌套时按外层标签提取（内层留在 body 里供外层 parser 处理或忽略）。
 */
function* iterateSubBlocks(body: string): Generator<SubBlock> {
  const re = /<([a-zA-Z][a-zA-Z0-9_]*)>([\s\S]*?)<\/([a-zA-Z][a-zA-Z0-9_]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const openName = m[1];
    const closeName = m[3];
    if (openName.toLowerCase() !== closeName.toLowerCase()) {
      // 开闭不匹配 — 跳过这个 match（继续找下一个，但这一段相当于丢失）
      continue;
    }
    yield { name: openName, body: m[2] };
  }
}

// ── <var> 子块解析 ───────────────────────────────────────────

const EMOTION_LINE_RE = /^情绪\s*[:：]\s*(.+)$/;
const VAR_UPDATE_RE = /^(.+?)\s*[:：]\s*(-?[\d.]+)\s*(?:→|->|—>)\s*(-?[\d.]+)\s*(?:\|(.+))?$/;

function parseVarBlockInto(body: string, result: ParsedAIOutput): void {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // 1. 情绪行
    const emoMatch = line.match(EMOTION_LINE_RE);
    if (emoMatch) {
      const emo = parseEmotionTail(emoMatch[1]);
      if (emo) {
        result.emotion = emo;
      } else {
        result.diagnostics.skippedLines.push({ block: 'var', line, reason: 'emotion-format' });
        traceDetail('aiProtocol', 'protocol.var.skip', `情绪行格式错: ${line}`, { line, reason: 'emotion-format' });
      }
      continue;
    }

    // 2. 数值更新行
    const updMatch = line.match(VAR_UPDATE_RE);
    if (updMatch) {
      const variableName = updMatch[1].trim();
      const oldValue = parseFloat(updMatch[2]);
      const newValue = parseFloat(updMatch[3]);
      const metaRaw = updMatch[4]?.trim();

      if (Number.isNaN(oldValue) || Number.isNaN(newValue)) {
        result.diagnostics.skippedLines.push({ block: 'var', line, reason: 'number-parse' });
        continue;
      }

      const meta = metaRaw ? parseMetadata(metaRaw, 'var', line, result) : {};
      const update: ParsedVarUpdate = { variableName, oldValue, newValue };
      if (meta.原因) update.reason = meta.原因;
      result.varUpdates.push(update);
      continue;
    }

    // 3. 不识别的行
    result.diagnostics.skippedLines.push({ block: 'var', line, reason: 'unknown-format' });
    traceDetail('aiProtocol', 'protocol.var.skip', `未识别行: ${line}`, { line, reason: 'unknown-format' });
  }
}

/**
 * 解析情绪行尾部（"情绪:" 之后的内容）。
 * 例："喜悦 60% | 紧张 40%" → [{word:'喜悦', pct:60}, {word:'紧张', pct:40}]
 * 百分比之和需在 95~105 之间。
 */
function parseEmotionTail(tail: string): ParsedEmotion | null {
  const segments = tail.split('|').map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  const parts: Array<{ word: string; pct: number }> = [];
  for (const seg of segments) {
    const m = seg.match(/^(.+?)\s+(\d+)\s*%$/);
    if (!m) return null;
    parts.push({ word: m[1].trim(), pct: parseInt(m[2], 10) });
  }
  const sum = parts.reduce((a, b) => a + b.pct, 0);
  if (Math.abs(sum - 100) > 5) return null;
  return { raw: tail, parts };
}

// ── <event> 子块解析 ─────────────────────────────────────────

const EVENT_LINE_RE = /^([a-zA-Z0-9_\-]+)\s*[:：]\s*([^\|]+?)\s*(?:\|(.+))?$/;

function parseEventBlockInto(body: string, result: ParsedAIOutput): void {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const m = line.match(EVENT_LINE_RE);
    if (!m) {
      result.diagnostics.skippedLines.push({ block: 'event', line, reason: 'unknown-format' });
      traceDetail('aiProtocol', 'protocol.event.skip', `未识别行: ${line}`, { line, reason: 'unknown-format' });
      continue;
    }

    const eventId = m[1].trim();
    const outcome = m[2].trim();
    const metaRaw = m[3]?.trim();

    if (!eventId || !outcome) {
      result.diagnostics.skippedLines.push({ block: 'event', line, reason: 'empty-fields' });
      continue;
    }

    const meta = metaRaw ? parseMetadata(metaRaw, 'event', line, result) : {};
    const evt: ParsedEventOutcome = { eventId, outcome };
    if (meta.原因) evt.reason = meta.原因;
    result.events.push(evt);
  }
}

// ── 元数据解析（| key: value | key: value ...）────────────────

const META_KV_RE = /^\s*([一-龥\w]+)\s*[:：]\s*(.+)$/;

const KNOWN_META_KEYS = new Set(['原因']);

/**
 * 解析行尾的 `| key: value | key: value` 元数据段。
 * 已识别 key 直接返回；未识别 key 记 trace 警告但不报错。
 */
function parseMetadata(
  raw: string,
  block: string,
  line: string,
  result: ParsedAIOutput,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of raw.split('|')) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const m = trimmed.match(META_KV_RE);
    if (!m) {
      traceDetail('aiProtocol', `protocol.${block}.meta.skip`, `元数据段格式错: ${trimmed}`, {
        line, segment: trimmed, reason: 'meta-format',
      });
      continue;
    }
    const key = m[1].trim();
    const value = m[2].trim();
    if (KNOWN_META_KEYS.has(key)) {
      out[key] = value;
    } else {
      traceDetail('aiProtocol', `protocol.${block}.meta.unknown`, `未识别元数据 key=${key}`, {
        line, key, value, reason: 'unknown-meta-key',
      });
    }
  }
  return out;
}
