import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import pg from 'pg';
import type { DatabaseSchema } from './types.js';

export function createDatabase(databaseUrl: string): Kysely<DatabaseSchema> {
  if (databaseUrl.startsWith('sqlite://')) {
    const configuredPath = databaseUrl.slice('sqlite://'.length) || './data/bot.db';
    const filename = configuredPath === ':memory:' ? ':memory:' : resolve(configuredPath);
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    const sqlite = new Database(filename);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    return new Kysely<DatabaseSchema>({ dialect: new SqliteDialect({ database: sqlite }) });
  }
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: databaseUrl, max: 5 }) }),
  });
}
