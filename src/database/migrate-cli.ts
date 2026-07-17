import { loadConfig } from '../config.js';
import { createDatabase } from './client.js';
import { migrateToLatest } from './migrate.js';

const config = loadConfig();
const database = createDatabase(config.DATABASE_URL);
try {
  await migrateToLatest(database);
  console.log('Миграции успешно применены.');
} finally {
  await database.destroy();
}
