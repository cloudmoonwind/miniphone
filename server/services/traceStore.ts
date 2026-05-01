/**
 * Trace 日志：按本地日期分文件的 JSONL 存储。
 *
 * - 路径：server/data/logs/trace/YYYY-MM-DD.jsonl
 * - 一行：一个完整 trace（一次业务轮次）
 * - 保留：默认 3 天，可用 TRACE_LOG_RETENTION_DAYS 调整
 */

import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, '../data/logs/trace');
const RETENTION_DAYS_DEFAULT = Number.parseInt(process.env.TRACE_LOG_RETENTION_DAYS || '3', 10) || 3;

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

export interface TraceLogEntry {
  id: string;
  source: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  characterId: string | null;
  metadata: Record<string, any>;
  aiCallIds: string[];
  eventCount: number;
  summaryStats: Record<string, any>;
  incomplete: boolean;
  truncationReason: string | null;
  droppedEventCount: number;
  truncatedEventCount: number;
  events: any[];
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

function maybePurge(retentionDays = RETENTION_DAYS_DEFAULT): Promise<void> {
  const today = dateKey();
  if (today === lastPurgeDate) return Promise.resolve();
  if (purgePromise) return purgePromise;
  lastPurgeDate = today;
  purgePromise = purgeOlderThan(retentionDays).finally(() => { purgePromise = null; });
  return purgePromise;
}

export async function appendTrace(trace: TraceLogEntry): Promise<void> {
  const file = pathFor(dateKey(new Date(trace.startedAt)));
  const line = JSON.stringify(trace) + '\n';
  try {
    await fs.appendFile(file, line, 'utf8');
  } catch (err: any) {
    console.error('[traceStore.appendTrace]', err?.message ?? err);
  }
  maybePurge().catch(err => console.error('[traceStore.purge]', err?.message ?? err));
}

export async function listTraceDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOG_DIR);
    return files
      .filter(name => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .map(name => name.replace(/\.jsonl$/, ''))
      .sort()
      .reverse();
  } catch (err: any) {
    console.error('[traceStore.listTraceDates]', err?.message ?? err);
    return [];
  }
}

export async function readTracesByDate(date: string): Promise<TraceLogEntry[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  try {
    const raw = await fs.readFile(pathFor(date), 'utf8');
    return raw
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as TraceLogEntry; }
        catch { return null; }
      })
      .filter((entry): entry is TraceLogEntry => entry !== null);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    console.error('[traceStore.readTracesByDate]', err?.message ?? err);
    return [];
  }
}

export async function deleteTracesByDate(date: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  try {
    await fs.unlink(pathFor(date));
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    console.error('[traceStore.deleteTracesByDate]', err?.message ?? err);
    return false;
  }
}

export async function deleteTraceById(date: string, id: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !id) return false;
  const traces = await readTracesByDate(date);
  const next = traces.filter(trace => trace.id !== id);
  if (next.length === traces.length) return false;

  try {
    if (next.length === 0) {
      await fs.unlink(pathFor(date));
    } else {
      const content = next.map(trace => JSON.stringify(trace)).join('\n') + '\n';
      await fs.writeFile(pathFor(date), content, 'utf8');
    }
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    console.error('[traceStore.deleteTraceById]', err?.message ?? err);
    return false;
  }
}

export async function purgeOlderThan(retentionDays = RETENTION_DAYS_DEFAULT): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffKey = dateKey(cutoff);

  const dates = await listTraceDates();
  for (const d of dates) {
    if (d < cutoffKey) {
      try {
        await fs.unlink(pathFor(d));
      } catch (err: any) {
        console.error('[traceStore.purge.unlink]', d, err?.message ?? err);
      }
    }
  }
}

export const __testing = { LOG_DIR, RETENTION_DAYS_DEFAULT };
