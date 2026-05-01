/**
 * AI 调用日志：按本地日期分文件的 JSONL 存储。
 *
 * - 路径：server/data/logs/ai/YYYY-MM-DD.jsonl
 * - 写入：异步追加，失败时 console.error，不抛
 * - 保留：默认 14 天，启动时清理一次 + 每次写入顺手判断
 * - 不进 SQLite：调试数据，避免污染备份/迁移流程
 */

import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, '../data/logs/ai');
const RETENTION_DAYS_DEFAULT = 14;

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

export type AiLogEndpoint = 'chat' | 'chatStream' | 'listModels' | 'testConnection';
export type AiLogErrorPhase = 'before-call' | 'mid-stream' | 'after-stream';
export type AiLogStreamAbortType =
  | 'none'
  | 'before-call-error'
  | 'upstream-error'
  | 'client-disconnect'
  | 'server-cancel'
  | 'consumer-break';

export interface AiLogEntry {
  id: string;
  traceId: string | null;
  timestamp: string;            // ISO
  endpoint: AiLogEndpoint;
  source: string | null;        // 业务来源：chat.respond / dream.generate / settings.testConnection 等
  provider: string;             // 'openai' | 'zhipu' | ...
  baseURL: string;
  model: string;
  durationMs: number;
  inputMessages: any[] | null;
  output: string | any | null;  // 流式失败时也保留已收到的部分
  usage: any | null;
  streamChunks: number | null;
  streamAborted: boolean | null;
  streamCompleted: boolean | null;
  streamAbortType: AiLogStreamAbortType | null;
  error: string | null;
  status: number | null;
  errorPhase: AiLogErrorPhase | null;
}

function genId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function dateKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pathFor(date: string): string {
  return join(LOG_DIR, `${date}.jsonl`);
}

let purgePromise: Promise<void> | null = null;
let lastPurgeDate = '';

/** 按需清理过期文件（每天最多跑一次，避免每条写入都扫目录） */
function maybePurge(retentionDays = RETENTION_DAYS_DEFAULT): Promise<void> {
  const today = dateKey();
  if (today === lastPurgeDate) return Promise.resolve();
  if (purgePromise) return purgePromise;
  lastPurgeDate = today;
  purgePromise = purgeOlderThan(retentionDays).finally(() => { purgePromise = null; });
  return purgePromise;
}

/** 写一条日志（异步，失败时不抛） */
export async function appendEntry(entry: Omit<AiLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<void> {
  const full: AiLogEntry = {
    id: entry.id ?? genId(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    traceId: entry.traceId ?? null,
    endpoint: entry.endpoint,
    source: entry.source ?? null,
    provider: entry.provider,
    baseURL: entry.baseURL,
    model: entry.model,
    durationMs: entry.durationMs,
    inputMessages: entry.inputMessages ?? null,
    output: entry.output ?? null,
    usage: entry.usage ?? null,
    streamChunks: entry.streamChunks ?? null,
    streamAborted: entry.streamAborted ?? null,
    streamCompleted: entry.streamCompleted ?? null,
    streamAbortType: entry.streamAbortType ?? null,
    error: entry.error ?? null,
    status: entry.status ?? null,
    errorPhase: entry.errorPhase ?? null,
  };
  const file = pathFor(dateKey(new Date(full.timestamp)));
  const line = JSON.stringify(full) + '\n';
  try {
    await fs.appendFile(file, line, 'utf8');
  } catch (err: any) {
    console.error('[aiLogStore.append]', err?.message ?? err);
  }
  maybePurge().catch(err => console.error('[aiLogStore.purge]', err?.message ?? err));
}

/** 列出有日志的日期（倒序，新→旧） */
export async function listDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOG_DIR);
    return files
      .filter(name => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .map(name => name.replace(/\.jsonl$/, ''))
      .sort()
      .reverse();
  } catch (err: any) {
    console.error('[aiLogStore.listDates]', err?.message ?? err);
    return [];
  }
}

/** 读某天全部条目（按时间正序，最旧的在前） */
export async function readByDate(date: string): Promise<AiLogEntry[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  try {
    const raw = await fs.readFile(pathFor(date), 'utf8');
    return raw
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as AiLogEntry; }
        catch { return null; }
      })
      .filter((e): e is AiLogEntry => e !== null);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    console.error('[aiLogStore.readByDate]', err?.message ?? err);
    return [];
  }
}

/** 删除某天的日志（用户在 UI 上点清空时调） */
export async function deleteByDate(date: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  try {
    await fs.unlink(pathFor(date));
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    console.error('[aiLogStore.deleteByDate]', err?.message ?? err);
    return false;
  }
}

/** 删除超过 N 天的文件（按文件名日期判断，不看 mtime） */
export async function purgeOlderThan(retentionDays = RETENTION_DAYS_DEFAULT): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffKey = dateKey(cutoff);

  const dates = await listDates();
  for (const d of dates) {
    if (d < cutoffKey) {
      try {
        await fs.unlink(pathFor(d));
      } catch (err: any) {
        console.error('[aiLogStore.purge.unlink]', d, err?.message ?? err);
      }
    }
  }
}

export const __testing = { LOG_DIR, RETENTION_DAYS_DEFAULT };
