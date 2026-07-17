import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/database/client.js';
import { migrateToLatest } from '../src/database/migrate.js';
import { Repository } from '../src/database/repository.js';
import type { DatabaseSchema } from '../src/database/types.js';
import type { GiveawaySource } from '../src/domain/giveaway.js';
import { createLogger } from '../src/logger.js';
import { CheckService } from '../src/services/check-service.js';
import type { GiveawaySender } from '../src/telegram/sender.js';

describe('CheckService', () => {
  let db: Kysely<DatabaseSchema>;
  let repository: Repository;
  beforeEach(async () => {
    db = createDatabase('sqlite://:memory:');
    await migrateToLatest(db);
    repository = new Repository(db);
  });
  afterEach(async () => db.destroy());

  it('continues when one source is unavailable and reports it for /games', async () => {
    const ok: GiveawaySource = {
      store: 'steam',
      fetch: vi
        .fn()
        .mockResolvedValue({ store: 'steam', fetchedAt: new Date(), giveaways: [game()] }),
    };
    const failed: GiveawaySource = {
      store: 'gog',
      fetch: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const service = new CheckService([ok, failed], repository, sender(), logger(), 0, 1);
    const current = await service.getCurrent(true);
    expect(current.giveaways).toHaveLength(1);
    expect(current.failedStores).toEqual(['gog']);
  });

  it('suppresses notifications on first run and delivers only a later new giveaway', async () => {
    await repository.setLanguage('42', 'ru', true);
    let games = [game('1')];
    const source: GiveawaySource = {
      store: 'steam',
      fetch: () => Promise.resolve({ store: 'steam', fetchedAt: new Date(), giveaways: games }),
    };
    const sendMock = vi.fn().mockResolvedValue({ success: true, blocked: false });
    const mockSender: GiveawaySender = { send: sendMock };
    const service = new CheckService([source], repository, mockSender, logger(), 0, 1000);
    await service.run(false);
    expect(sendMock).not.toHaveBeenCalled();
    games = [game('1'), game('2')];
    await service.run(false);
    expect(sendMock).not.toHaveBeenCalled();
    await service.run(true);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('retries a failed delivery but never repeats a successful one', async () => {
    await repository.setLanguage('42', 'en', true);
    let games = [game('1')];
    const source: GiveawaySource = {
      store: 'steam',
      fetch: () => Promise.resolve({ store: 'steam', fetchedAt: new Date(), giveaways: games }),
    };
    const sendMock = vi
      .fn()
      .mockResolvedValueOnce({ success: false, blocked: false, error: 'temporary' })
      .mockResolvedValue({ success: true, blocked: false });
    const service = new CheckService([source], repository, { send: sendMock }, logger(), 0, 1000);
    await service.run(false);
    games = [game('1'), game('2')];
    await service.run(false);
    await service.run(true);
    await service.run(true);
    await service.run(true);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

function game(id = '1') {
  return {
    externalId: id,
    title: `Game ${id}`,
    store: 'steam' as const,
    url: 'https://example.com',
    originalPrice: 10,
    kind: 'keep-forever' as const,
  };
}
function sender(): GiveawaySender {
  return { send: vi.fn().mockResolvedValue({ success: true, blocked: false }) };
}
function logger() {
  return createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });
}
