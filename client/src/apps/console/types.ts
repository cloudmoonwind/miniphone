export interface LogEntry {
  id: string;
  traceId: string | null;
  timestamp: string;
  endpoint: 'chat' | 'chatStream' | 'listModels' | 'testConnection';
  source: string | null;
  provider: string;
  baseURL: string;
  model: string;
  durationMs: number;
  inputMessages: any[] | null;
  output: string | any | null;
  usage: any | null;
  streamChunks: number | null;
  streamAborted: boolean | null;
  streamCompleted: boolean | null;
  streamAbortType: string | null;
  error: string | null;
  status: number | null;
  errorPhase: 'before-call' | 'mid-stream' | 'after-stream' | null;
}

export interface TraceEvent {
  id: string;
  parentId: string | null;
  ts: string;
  offsetMs: number;
  module: string;
  type: string;
  level: 'summary' | 'detail' | 'debug';
  message: string;
  data: any | null;
  truncated?: boolean;
  originalBytes?: number;
  keptBytes?: number;
}

export interface TraceEntry {
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
  events: TraceEvent[];
}

export type TabKey = 'ai' | 'trace' | 'caps';
export type LevelFilter = 'summary' | 'detail' | 'debug';
