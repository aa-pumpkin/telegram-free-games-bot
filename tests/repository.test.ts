import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/database/client.js';
import { migrateToLatest } from '../src/database/migrate.js';
import { Repository } from '../src/database/repository.js';
import type { DatabaseSchema } from '../src/database/types.js';

describe('Repository', () => {
  let db: Kysely<DatabaseSchema>;
  let repository: Repository;
  beforeEach(async () => {
    db = createDatabase('sqlite://:memory:');
    await migrateToLatest(db);
    repository = new Repository(db);
  });
  afterEach(async () => db.destroy());

  it('reactivates /start and deactivates /stop without duplicate subscriber rows', async () => {
    await repository.setSubscription('42', true);
    await repository.setSubscription('42', false);
    expect(await repository.isSubscribed('42')).toBe(false);
    await repository.setSubscription('42', true);
    expect(await repository.isSubscribed('42')).toBe(true);
    expect(await db.selectFrom('subscribers').selectAll().execute()).toHaveLength(1);
  });

  it('stores and changes only the selected interface language', async () => {
    await repository.setLanguage('42', 'ru', true);
    expect(await repository.getLanguage('42')).toBe('ru');
    expect(await repository.isSubscribed('42')).toBe(true);
    await repository.setLanguage('42', 'en', false);
    expect(await repository.getLanguage('42')).toBe('en');
    expect(await repository.isSubscribed('42')).toBe(true);
  });

  it('does not consider the first source snapshot new, but detects later games', async () => {
    const first = await repository.syncStore('steam', [game('1')], new Date());
    const second = await repository.syncStore('steam', [game('1'), game('2')], new Date());
    expect(first.bootstrapped).toBe(false);
    expect(first.fresh).toHaveLength(0);
    expect(second.fresh.map((item) => item.externalId)).toEqual(['2']);
  });

  it('records one delivery row and recognizes successful delivery', async () => {
    await repository.setSubscription('42', true);
    await repository.syncStore('steam', [], new Date());
    const synced = await repository.syncStore('steam', [game('1')], new Date());
    const id = synced.fresh[0]!.id;
    expect(await repository.wasDelivered(id, '42')).toBe(false);
    await repository.recordDelivery(id, '42', false, 'temporary');
    await repository.recordDelivery(id, '42', true);
    expect(await repository.wasDelivered(id, '42')).toBe(true);
    const rows = await db.selectFrom('deliveries').selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attempts).toBe(2);
  });

  it('allows only one process to claim the same delivery', async () => {
    await repository.setLanguage('42', 'en', true);
    await repository.syncStore('steam', [], new Date());
    const synced = await repository.syncStore('steam', [game('1')], new Date());
    const id = synced.fresh[0]!.id;

    const claims = await Promise.all([
      repository.claimDelivery(id, '42'),
      repository.claimDelivery(id, '42'),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    await repository.recordDelivery(id, '42', true);
    expect(await repository.claimDelivery(id, '42')).toBe(false);
  });
});

function game(id: string) {
  return {
    externalId: id,
    title: `Game ${id}`,
    store: 'steam' as const,
    url: `https://example.com/${id}`,
    originalPrice: 10,
    kind: 'keep-forever' as const,
  };
}
