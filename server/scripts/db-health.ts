import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { BLOB_TABLES, COLUMNAR_TABLES, CORE_TABLES, DB_PATH } from './db-common.js';

interface HealthResult {
  ok: boolean;
  sections: string[];
}

function q(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function tableNames(db: Database.Database): string[] {
  return (db.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>).map(row => row.name);
}

function columns(db: Database.Database, table: string): Array<{ name: string; type: string; notnull: number; pk: number }> {
  return db.prepare(`PRAGMA table_info(${q(table)})`).all() as any;
}

function indexes(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA index_list(${q(table)})`).all() as Array<{ name: string }>).map(row => row.name);
}

function foreignKeys(db: Database.Database, table: string): Array<Record<string, unknown>> {
  return db.prepare(`PRAGMA foreign_key_list(${q(table)})`).all() as any;
}

function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${q(table)}`).get() as { count: number }).count;
}

function hasIndex(db: Database.Database, indexName: string): boolean {
  const row = db.prepare(`
    SELECT name FROM sqlite_schema WHERE type = 'index' AND name = ?
  `).get(indexName);
  return Boolean(row);
}

function invalidJsonCount(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${q(table)} WHERE json_valid(data) = 0`).get() as { count: number }).count;
}

function section(title: string, body: string[]): string {
  return [`## ${title}`, ...body, ''].join('\n');
}

export function buildHealthReport(dbPath = DB_PATH): HealthResult {
  if (!existsSync(dbPath)) {
    return { ok: false, sections: [`database not found: ${dbPath}`] };
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma('foreign_keys = ON');

  const names = tableNames(db);
  const tableSet = new Set(names);
  const issues: string[] = [];
  const sections: string[] = [];

  const migrationRows = tableSet.has('__drizzle_migrations')
    ? db.prepare('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id').all()
    : [];
  sections.push(section('Migration Version', [
    `database: ${dbPath}`,
    ...migrationRows.map((row: any) => `- id=${row.id ?? ''} created_at=${row.created_at ?? ''} hash=${row.hash}`),
  ]));

  sections.push(section('Tables And Columns', names.map(name => {
    const colText = columns(db, name)
      .map(col => `${col.name} ${col.type || 'ANY'}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PK' : ''}`)
      .join(', ');
    const idxText = indexes(db, name).join(', ') || 'none';
    const fkText = foreignKeys(db, name)
      .map(fk => `${fk.from}->${fk.table}.${fk.to} on_delete=${fk.on_delete}`)
      .join('; ') || 'none';
    return `- ${name}: ${colText} | indexes: ${idxText} | fks: ${fkText}`;
  })));

  sections.push(section('Row Counts', names.map(name => `- ${name}: ${countRows(db, name)}`)));

  const missingTables = [...COLUMNAR_TABLES, ...BLOB_TABLES].filter(name => !tableSet.has(name));
  if (missingTables.length) issues.push(`missing tables: ${missingTables.join(', ')}`);

  const expectedCoreColumns: Record<string, string[]> = {
    characters: ['id', 'name', 'core', 'created_at', 'metadata'],
    messages: ['id', 'char_id', 'sender', 'content', 'timestamp', 'created_at', 'metadata'],
    summaries: ['id', 'char_id', 'type', 'content', 'created_at', 'metadata'],
    memories: ['id', 'char_id', 'content', 'created_at', 'metadata'],
  };
  for (const table of CORE_TABLES) {
    if (!tableSet.has(table)) continue;
    const actual = new Set(columns(db, table).map(col => col.name));
    const missing = expectedCoreColumns[table].filter(column => !actual.has(column));
    if (missing.length) issues.push(`${table} missing columnar columns: ${missing.join(', ')}`);
    if (actual.has('data')) issues.push(`${table} still has legacy data blob column`);
  }

  for (const table of BLOB_TABLES) {
    if (!tableSet.has(table)) continue;
    const actual = new Set(columns(db, table).map(col => col.name));
    for (const column of ['id', 'char_id', 'data', 'created_at']) {
      if (!actual.has(column)) issues.push(`${table} missing blob column: ${column}`);
    }
    const invalid = invalidJsonCount(db, table);
    if (invalid) issues.push(`${table} has ${invalid} invalid JSON rows`);
  }

  const requiredIndexes = [
    'ux_character_values_character_variable',
    'idx_messages_char_timestamp',
    'idx_summaries_char_type_date',
    'idx_memories_char_importance',
  ];
  for (const indexName of requiredIndexes) {
    if (!hasIndex(db, indexName)) issues.push(`missing index: ${indexName}`);
  }

  const foreignKeyFailures = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyFailures.length) issues.push(`foreign_key_check failures: ${JSON.stringify(foreignKeyFailures)}`);

  if (tableSet.has('characters')) {
    const orphanChecks = [
      ['messages_orphan', `SELECT COUNT(*) AS count FROM messages WHERE char_id IS NOT NULL AND char_id NOT IN (SELECT id FROM characters)`],
      ['summaries_orphan', `SELECT COUNT(*) AS count FROM summaries WHERE char_id IS NOT NULL AND char_id NOT IN (SELECT id FROM characters)`],
      ['memories_orphan', `SELECT COUNT(*) AS count FROM memories WHERE char_id IS NOT NULL AND char_id NOT IN (SELECT id FROM characters)`],
      ['character_values_orphan', `SELECT COUNT(*) AS count FROM character_values WHERE character_id NOT IN (SELECT id FROM characters)`],
      ['events_orphan_char', `SELECT COUNT(*) AS count FROM events WHERE character_id IS NOT NULL AND character_id NOT IN (SELECT id FROM characters)`],
      ['messages_missing_char_id', `SELECT COUNT(*) AS count FROM messages WHERE char_id IS NULL OR char_id = ''`],
    ];
    const orphanLines: string[] = [];
    for (const [name, sql] of orphanChecks) {
      if (!sql.includes('character_values') || tableSet.has('character_values')) {
        const count = (db.prepare(sql).get() as { count: number }).count;
        orphanLines.push(`- ${name}: ${count}`);
        if (count && name !== 'messages_missing_char_id') issues.push(`${name}: ${count}`);
      }
    }
    sections.push(section('Orphan Data', orphanLines));
  }

  sections.push(section('Blob Tables', BLOB_TABLES.map(name => {
    const status = tableSet.has(name) ? `${countRows(db, name)} rows` : 'missing';
    return `- ${name}: ${status}`;
  })));

  sections.push(section('Issues', issues.length ? issues.map(issue => `- ${issue}`) : ['none']));
  db.close();

  return { ok: issues.length === 0, sections };
}

const thisFile = resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (thisFile === entryFile) {
  const result = buildHealthReport(process.argv[2] || DB_PATH);
  console.log(result.sections.join('\n'));
  process.exitCode = result.ok ? 0 : 1;
}
