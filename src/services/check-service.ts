import {
  deduplicateGiveaways,
  isEligibleGiveaway,
  type Giveaway,
  type GiveawaySource,
  type Store,
} from '../domain/giveaway.js';
import type { Logger } from '../logger.js';
import type { Repository, StoredGiveaway } from '../database/repository.js';
import type { GiveawaySender } from '../telegram/sender.js';

export interface CurrentGames {
  giveaways: Giveaway[];
  failedStores: Store[];
  fromCache: boolean;
}
interface CachedSource {
  giveaways: Giveaway[];
  fetchedAt: Date;
}
const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class CheckService {
  private running = false;
  private readonly cache = new Map<Store, CachedSource>();
  constructor(
    private readonly sources: GiveawaySource[],
    private readonly repository: Repository,
    private readonly sender: GiveawaySender,
    private readonly logger: Logger,
    private readonly sendDelayMs: number,
    private readonly cacheTtlMs: number,
  ) {}

  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Проверка уже выполняется, новый запуск пропущен');
      return;
    }
    this.running = true;
    const started = Date.now();
    try {
      const outcomes = await Promise.allSettled(this.sources.map((source) => source.fetch()));
      let newCount = 0;
      let failedCount = 0;
      for (const [index, outcome] of outcomes.entries()) {
        const source = this.sources[index];
        if (!source) continue;
        if (outcome.status === 'rejected') {
          failedCount += 1;
          this.logger.error(
            {
              store: source.store,
              error:
                outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
            },
            'Источник недоступен',
          );
          continue;
        }
        const valid = deduplicateGiveaways(outcome.value.giveaways).filter((item) =>
          isEligibleGiveaway(item),
        );
        this.cache.set(source.store, { giveaways: valid, fetchedAt: outcome.value.fetchedAt });
        try {
          const synced = await this.repository.syncStore(
            source.store,
            valid,
            outcome.value.fetchedAt,
          );
          if (!synced.bootstrapped)
            this.logger.info(
              { store: source.store, count: valid.length },
              'Первичная база источника сохранена без рассылки',
            );
          newCount += synced.fresh.length;
        } catch (error) {
          failedCount += 1;
          this.logger.error(
            { store: source.store, error: error instanceof Error ? error.message : String(error) },
            'Не удалось сохранить данные источника',
          );
        }
      }
      await this.deliver(await this.repository.notificationEligibleGiveaways());
      this.logger.info(
        { durationMs: Date.now() - started, newCount, failedCount },
        'Проверка магазинов завершена',
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Проверка завершилась ошибкой базы данных',
      );
    } finally {
      this.running = false;
    }
  }

  async getCurrent(forceRefresh = false): Promise<CurrentGames> {
    const now = new Date();
    const allFresh = this.sources.every((source) => {
      const cached = this.cache.get(source.store);
      return cached && now.getTime() - cached.fetchedAt.getTime() < this.cacheTtlMs;
    });
    if (!forceRefresh && allFresh) {
      return { giveaways: this.filteredCache(now), failedStores: [], fromCache: true };
    }
    const outcomes = await Promise.allSettled(this.sources.map((source) => source.fetch(now)));
    const failedStores: Store[] = [];
    for (const [index, outcome] of outcomes.entries()) {
      const source = this.sources[index];
      if (!source) continue;
      if (outcome.status === 'fulfilled') {
        this.cache.set(source.store, {
          giveaways: outcome.value.giveaways,
          fetchedAt: outcome.value.fetchedAt,
        });
      } else {
        failedStores.push(source.store);
        this.logger.warn({ store: source.store }, 'Не удалось обновить источник по команде /games');
      }
    }
    return { giveaways: this.filteredCache(now), failedStores, fromCache: false };
  }

  private filteredCache(now: Date): Giveaway[] {
    return deduplicateGiveaways(
      [...this.cache.values()].flatMap((entry) => entry.giveaways),
    ).filter((item) => isEligibleGiveaway(item, now));
  }

  private async deliver(giveaways: StoredGiveaway[]): Promise<void> {
    if (giveaways.length === 0) return;
    const subscribers = await this.repository.activeSubscribers();
    for (const giveaway of giveaways) {
      for (const subscriber of subscribers) {
        const { chatId, language } = subscriber;
        try {
          if (await this.repository.wasDelivered(giveaway.id, chatId)) continue;
          const result = await this.sender.send(chatId, giveaway, language, true);
          await this.repository.recordDelivery(giveaway.id, chatId, result.success, result.error);
          if (result.blocked) {
            await this.repository.setSubscription(chatId, false);
            this.logger.info({ chatId }, 'Подписка отключена: бот заблокирован или чат недоступен');
          } else if (!result.success) {
            this.logger.warn(
              { chatId, giveawayId: giveaway.id, error: result.error },
              'Ошибка доставки',
            );
          }
        } catch (error) {
          this.logger.error(
            {
              chatId,
              giveawayId: giveaway.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Ошибка обработки доставки; остальные получатели будут обработаны',
          );
        }
        await delay(this.sendDelayMs);
      }
    }
  }
}
