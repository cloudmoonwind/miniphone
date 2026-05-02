/**
 * 占位符通用解析器（变量管道底座）。
 *
 * 所有"作者可写文本"经过此入口解析 {{namespace:identifier:modifier}} 占位符。
 * 子系统在启动时通过 registerNamespace 注册自己的命名空间。
 *
 * 命名空间表见 docs/archive/ICS_近期开发计划_v1.md 第二节（已归档冻结）。
 */

import { traceDetail } from './trace.js';

// ── 类型 ──────────────────────────────────────────────────────────

export interface ResolveContext {
  characterId: string;
  personaId?: string | null;
  messageId?: string | null;
  /** 当前对话模式（'online' / 'offline' / 自定义），供 mode: 命名空间使用 */
  mode?: string | null;
}

/**
 * resolver 约定：
 * - 识别 identifier → 返回字符串（即使空字符串也算识别）
 * - 不识别 identifier → 返回 null/undefined，由解析器代为生成 [未知字段:...] 标记
 * - 抛异常 → 解析器代为生成 [解析错误:...] 标记，不让单个变量爆掉整段文本
 */
export type Resolver = (
  identifier: string,
  modifier: string | null,
  ctx: ResolveContext,
) => string | null | undefined;

export interface NamespaceListing {
  identifier: string;
  description?: string;
  /** 已知支持的 modifier 列表（用于能力清单页展示），可选 */
  modifiers?: string[];
}

/**
 * 命名空间自省函数。可选接收 ctx：
 * - 静态命名空间（time/util）忽略 ctx 即可
 * - 动态命名空间（val/char）依据 ctx 列出当前角色的 identifier
 * - 不带 ctx 调用时（如启动期粗略概览），动态命名空间可返回空数组或全局已知集合
 */
export type NamespaceLister = (ctx?: ResolveContext) => NamespaceListing[];

interface NamespaceRegistration {
  resolver: Resolver;
  list: NamespaceLister;
}

// ── 注册表 ────────────────────────────────────────────────────────

const registry = new Map<string, NamespaceRegistration>();

const NAMESPACE_NAME_RE = /^[a-z][a-z0-9_]*$/;

/**
 * 注册一个命名空间。同名重复注册会覆盖（启动钩子重复调用时容错）。
 * 命名空间名约束：小写字母开头，后续仅可含小写字母/数字/下划线。
 */
export function registerNamespace(
  name: string,
  resolver: Resolver,
  list: NamespaceLister,
): void {
  if (!NAMESPACE_NAME_RE.test(name)) {
    throw new Error(`invalid namespace name: ${name}`);
  }
  registry.set(name, { resolver, list });
}

/** 仅供测试使用：清空注册表 */
export function __clearRegistry(): void {
  registry.clear();
}

// ── 解析 ──────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{(\w+):(\w+)(?::(\w+))?\}\}/g;

export interface ResolveRecord {
  raw: string;
  namespace: string;
  identifier: string;
  modifier: string | null;
  result: string;
  status: 'ok' | 'unknown-namespace' | 'unknown-field' | 'error';
  error?: string;
}

/**
 * 解析占位符，同时返回每条占位符的命中详情（供测试器/能力清单页展示）。
 * 不发 trace（trace 由 resolvePlaceholders 的便捷封装发）。
 */
export function resolveAndExplain(template: string, ctx: ResolveContext): {
  output: string;
  records: ResolveRecord[];
} {
  if (!template) return { output: template, records: [] };

  const records: ResolveRecord[] = [];

  const output = template.replace(PLACEHOLDER_RE, (match, ns: string, id: string, mod?: string) => {
    const reg = registry.get(ns);
    if (!reg) {
      const result = `[未知命名空间:${ns}]`;
      records.push({ raw: match, namespace: ns, identifier: id, modifier: mod ?? null, result, status: 'unknown-namespace' });
      return result;
    }
    try {
      const value = reg.resolver(id, mod ?? null, ctx);
      if (value == null) {
        const result = mod ? `[未知字段:${ns}:${id}:${mod}]` : `[未知字段:${ns}:${id}]`;
        records.push({ raw: match, namespace: ns, identifier: id, modifier: mod ?? null, result, status: 'unknown-field' });
        return result;
      }
      const str = String(value);
      records.push({ raw: match, namespace: ns, identifier: id, modifier: mod ?? null, result: str, status: 'ok' });
      return str;
    } catch (err: any) {
      const result = `[解析错误:${ns}:${id}]`;
      records.push({
        raw: match,
        namespace: ns,
        identifier: id,
        modifier: mod ?? null,
        result,
        status: 'error',
        error: err?.message ?? String(err),
      });
      return result;
    }
  });

  return { output, records };
}

/**
 * 把模板里的 {{ns:id}} / {{ns:id:mod}} 占位符替换为求值结果。
 * 返回原文（无占位符时）或替换后的文本。
 */
export function resolvePlaceholders(template: string, ctx: ResolveContext): string {
  const { output, records } = resolveAndExplain(template, ctx);
  if (records.length > 0) {
    traceDetail('placeholders', 'placeholders.resolve', `${records.length} placeholders resolved`, {
      count: records.length,
      records,
      contextSummary: { characterId: ctx.characterId, personaId: ctx.personaId ?? null },
    });
  }
  return output;
}

// ── 自省 ──────────────────────────────────────────────────────────

/** 列出所有已注册命名空间及其 identifier 清单（用于能力清单页 / GET /api/capabilities） */
export function listRegistered(ctx?: ResolveContext): Array<{
  namespace: string;
  identifiers: NamespaceListing[];
}> {
  return [...registry.entries()].map(([namespace, reg]) => {
    let identifiers: NamespaceListing[] = [];
    try {
      identifiers = reg.list(ctx);
    } catch {
      identifiers = [];
    }
    return { namespace, identifiers };
  });
}
