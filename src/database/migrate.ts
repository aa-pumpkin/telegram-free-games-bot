import type { Kysely } from 'kysely';
import type { DatabaseSchema } from './types.js';

export async function migrateToLatest(db: Kysely<DatabaseSchema>): Promise<void> {
  await db.schema
    .createTable('subscribers')
    .ifNotExists()
    .addColumn('chat_id', 'varchar(32)', (column) => column.primaryKey())
    .addColumn('active', 'integer', (column) => column.notNull())
    .addColumn('language', 'varchar(2)')
    .addColumn('created_at', 'varchar(32)', (column) => column.notNull())
    .addColumn('updated_at', 'varchar(32)', (column) => column.notNull())
    .execute();
  await db.schema
    .createTable('giveaways')
    .ifNotExists()
    .addColumn('id', 'varchar(36)', (column) => column.primaryKey())
    .addColumn('store', 'varchar(16)', (column) => column.notNull())
    .addColumn('external_id', 'varchar(128)', (column) => column.notNull())
    .addColumn('title', 'varchar(512)', (column) => column.notNull())
    .addColumn('url', 'text', (column) => column.notNull())
    .addColumn('image_url', 'text')
    .addColumn('image_urls', 'text')
    .addColumn('description', 'text')
    .addColumn('description_en', 'text')
    .addColumn('description_ru', 'text')
    .addColumn('original_price', 'real')
    .addColumn('currency', 'varchar(8)')
    .addColumn('starts_at', 'varchar(32)')
    .addColumn('ends_at', 'varchar(32)')
    .addColumn('kind', 'varchar(32)', (column) => column.notNull())
    .addColumn('first_seen_at', 'varchar(32)', (column) => column.notNull())
    .addColumn('last_checked_at', 'varchar(32)', (column) => column.notNull())
    .addColumn('active', 'integer', (column) => column.notNull())
    .addColumn('notification_eligible', 'integer', (column) => column.notNull().defaultTo(0))
    .addUniqueConstraint('giveaways_store_external_unique', ['store', 'external_id'])
    .execute();
  await db.schema
    .createTable('deliveries')
    .ifNotExists()
    .addColumn('id', 'varchar(36)', (column) => column.primaryKey())
    .addColumn('giveaway_id', 'varchar(36)', (column) =>
      column.notNull().references('giveaways.id').onDelete('cascade'),
    )
    .addColumn('chat_id', 'varchar(32)', (column) =>
      column.notNull().references('subscribers.chat_id').onDelete('cascade'),
    )
    .addColumn('status', 'varchar(16)', (column) => column.notNull())
    .addColumn('sent_at', 'varchar(32)')
    .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('last_error', 'text')
    .addUniqueConstraint('deliveries_giveaway_chat_unique', ['giveaway_id', 'chat_id'])
    .execute();
  await db.schema
    .createTable('app_state')
    .ifNotExists()
    .addColumn('key', 'varchar(128)', (column) => column.primaryKey())
    .addColumn('value', 'text', (column) => column.notNull())
    .addColumn('updated_at', 'varchar(32)', (column) => column.notNull())
    .execute();
  const tables = await db.introspection.getTables();
  const subscribers = tables.find((table) => table.name === 'subscribers');
  if (subscribers && !subscribers.columns.some((column) => column.name === 'language')) {
    await db.schema.alterTable('subscribers').addColumn('language', 'varchar(2)').execute();
  }
  const giveaways = tables.find((table) => table.name === 'giveaways');
  if (giveaways && !giveaways.columns.some((column) => column.name === 'image_urls')) {
    await db.schema.alterTable('giveaways').addColumn('image_urls', 'text').execute();
  }
  if (giveaways && !giveaways.columns.some((column) => column.name === 'description_en')) {
    await db.schema.alterTable('giveaways').addColumn('description_en', 'text').execute();
  }
  if (giveaways && !giveaways.columns.some((column) => column.name === 'description_ru')) {
    await db.schema.alterTable('giveaways').addColumn('description_ru', 'text').execute();
  }
  await db.schema
    .createIndex('giveaways_active_index')
    .ifNotExists()
    .on('giveaways')
    .column('active')
    .execute();
  await db.schema
    .createIndex('giveaways_notification_index')
    .ifNotExists()
    .on('giveaways')
    .columns(['active', 'notification_eligible'])
    .execute();
  await db.schema
    .createIndex('subscribers_active_index')
    .ifNotExists()
    .on('subscribers')
    .column('active')
    .execute();
}
