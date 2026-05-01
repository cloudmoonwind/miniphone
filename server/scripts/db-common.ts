import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = resolve(__dirname, '..');
export const DATA_DIR = resolve(SERVER_ROOT, 'data');
export const DB_PATH = resolve(DATA_DIR, 'ics.db');
export const MIGRATIONS_PATH = resolve(SERVER_ROOT, 'db/migrations');
export const BACKUP_ROOT = resolve(DATA_DIR, 'backups');

export const CORE_TABLES = ['characters', 'messages', 'summaries', 'memories'];

export const BLOB_TABLES = [
  'active',
  'presets',
  'prompt_presets',
  'char_stats',
  'stat_defs',
  'life',
  'items',
  'timeline',
  'skills',
  'relations',
  'dreams',
  'personas',
  'maps',
  'calendar_events',
  'dafu_game',
  'diary',
  'suixiang_cards',
  'suixiang_entries',
];

export const COLUMNAR_TABLES = [
  'sessions',
  'characters',
  'messages',
  'summaries',
  'memories',
  'character_values',
  'value_stages',
  'value_rules',
  'event_books',
  'events',
  'event_tags',
  'event_connections',
  'condition_subscriptions',
  'pending_injections',
  'worldbooks',
  'worldbook_entries',
  'worldbook_event_entries',
  'world_state',
];

export const COPY_TABLES = [
  'sessions',
  'character_values',
  'value_stages',
  'value_rules',
  'event_books',
  'events',
  'event_tags',
  'event_connections',
  'condition_subscriptions',
  'pending_injections',
  'worldbooks',
  'worldbook_entries',
  'worldbook_event_entries',
  'world_state',
  ...BLOB_TABLES,
];

export function timestampForPath(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}
