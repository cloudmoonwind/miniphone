import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BACKUP_ROOT, DB_PATH, timestampForPath } from './db-common.js';

export interface BackupResult {
  dir: string;
  sqliteBackup: string;
}

function rowsToLines(rows: unknown[]): string {
  return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}

export async function backupDatabase(sourcePath = DB_PATH, backupRoot = BACKUP_ROOT): Promise<BackupResult> {
  if (!existsSync(sourcePath)) {
    throw new Error(`database not found: ${sourcePath}`);
  }

  const dir = resolve(backupRoot, timestampForPath());
  mkdirSync(dir, { recursive: true });

  const rawDb = join(dir, basename(sourcePath));
  copyFileSync(sourcePath, rawDb);

  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${sourcePath}${suffix}`;
    if (existsSync(sidecar)) copyFileSync(sidecar, join(dir, `${basename(sourcePath)}${suffix}`));
  }

  const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
  const sqliteBackup = join(dir, 'ics.sqlite-backup.db');
  await db.backup(sqliteBackup);

  const schemaRows = db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_schema
    WHERE sql IS NOT NULL
    ORDER BY type, name
  `).all();
  writeFileSync(join(dir, 'schema.jsonl'), rowsToLines(schemaRows), 'utf8');
  writeFileSync(
    join(dir, 'schema.sql'),
    schemaRows.map((row: any) => `${row.sql};`).join('\n\n') + '\n',
    'utf8',
  );

  const tables = db.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;
  writeFileSync(join(dir, 'tables.txt'), tables.map(t => t.name).join('\n') + '\n', 'utf8');

  const counts = tables.map(({ name }) => {
    const count = db.prepare(`SELECT COUNT(*) AS count FROM "${name.replaceAll('"', '""')}"`).get() as { count: number };
    return { table: name, count: count.count };
  });
  writeFileSync(join(dir, 'row-counts.json'), JSON.stringify(counts, null, 2) + '\n', 'utf8');

  const migrations = db.prepare(`
    SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id
  `).all();
  writeFileSync(join(dir, 'migrations.json'), JSON.stringify(migrations, null, 2) + '\n', 'utf8');

  const files = [rawDb, sqliteBackup].map(file => ({ file, bytes: statSync(file).size }));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ sourcePath, files, createdAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');

  db.close();
  return { dir, sqliteBackup };
}

const thisFile = resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (thisFile === entryFile) {
  backupDatabase()
    .then(result => {
      console.log(`[db:backup] ${result.dir}`);
      console.log(`[db:backup] sqlite backup: ${result.sqliteBackup}`);
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
