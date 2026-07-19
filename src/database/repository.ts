import type { Kysely, Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { Giveaway, Language, Store } from '../domain/giveaway.js';
import type { DatabaseSchema, GiveawayTable } from './types.js';

export interface StoredGiveaway extends Giveaway {
  id: string;
}

function toDomain(row: Selectable<GiveawayTable>): StoredGiveaway {
  const giveaway: StoredGiveaway = {
    id: row.id,
    externalId: row.external_id,
    title: row.title,
    store: row.store as Store,
    url: row.url,
    kind: 'keep-forever',
  };
  if (row.image_url) giveaway.imageUrl = row.image_url;
  if (row.image_urls) {
    try {
      const parsed: unknown = JSON.parse(row.image_urls);
      if (Array.isArray(parsed)) {
        const urls = parsed.filter(
          (value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value),
        );
        if (urls.length > 0) giveaway.imageUrls = urls.slice(0, 5);
      }
    } catch {
      // Keep the legacy single image when an old value cannot be parsed.
    }
  }
  if (row.description) giveaway.description = row.description;
  const descriptions: Partial<Record<Language, string>> = {};
  if (row.description_en) descriptions.en = row.description_en;
  if (row.description_ru) descriptions.ru = row.description_ru;
  if (Object.keys(descriptions).length > 0) giveaway.descriptions = descriptions;
  if (row.original_price !== null) giveaway.originalPrice = row.original_price;
  if (row.currency) giveaway.currency = row.currency;
  if (row.starts_at) giveaway.startsAt = new Date(row.starts_at);
  if (row.ends_at) giveaway.endsAt = new Date(row.ends_at);
  return giveaway;
}

export class Repository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async setSubscription(chatId: string, active: boolean, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    await this.db
      .insertInto('subscribers')
      .values({
        chat_id: chatId,
        active: active ? 1 : 0,
        language: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflict((conflict) =>
        conflict.column('chat_id').doUpdateSet({ active: active ? 1 : 0, updated_at: timestamp }),
      )
      .execute();
  }

  async isSubscribed(chatId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('subscribers')
      .select('active')
      .where('chat_id', '=', chatId)
      .executeTakeFirst();
    return row?.active === 1;
  }

  async getLanguage(chatId: string): Promise<Language | undefined> {
    const row = await this.db
      .selectFrom('subscribers')
      .select('language')
      .where('chat_id', '=', chatId)
      .executeTakeFirst();
    return row?.language === 'ru' || row?.language === 'en' ? row.language : undefined;
  }

  async setLanguage(
    chatId: string,
    language: Language,
    activate: boolean,
    now = new Date(),
  ): Promise<void> {
    const timestamp = now.toISOString();
    await this.db
      .insertInto('subscribers')
      .values({
        chat_id: chatId,
        active: activate ? 1 : 0,
        language,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflict((conflict) =>
        conflict.column('chat_id').doUpdateSet((expression) => ({
          language,
          active: activate ? 1 : expression.ref('subscribers.active'),
          updated_at: timestamp,
        })),
      )
      .execute();
  }

  async activeChatIds(): Promise<string[]> {
    return (
      await this.db.selectFrom('subscribers').select('chat_id').where('active', '=', 1).execute()
    ).map((row) => row.chat_id);
  }

  async activeSubscribers(): Promise<Array<{ chatId: string; language: Language }>> {
    const rows = await this.db
      .selectFrom('subscribers')
      .select(['chat_id', 'language'])
      .where('active', '=', 1)
      .where('language', 'is not', null)
      .execute();
    return rows.flatMap((row) =>
      row.language === 'ru' || row.language === 'en'
        ? [{ chatId: row.chat_id, language: row.language }]
        : [],
    );
  }

  async syncStore(
    store: Store,
    giveaways: Giveaway[],
    checkedAt: Date,
  ): Promise<{ fresh: StoredGiveaway[]; bootstrapped: boolean }> {
    return this.db.transaction().execute(async (trx) => {
      const bootstrapKey = `source_bootstrapped:${store}`;
      const state = await trx
        .selectFrom('app_state')
        .select('value')
        .where('key', '=', bootstrapKey)
        .executeTakeFirst();
      const bootstrapped = state?.value === 'true';
      const timestamp = checkedAt.toISOString();
      const fresh: StoredGiveaway[] = [];
      for (const giveaway of giveaways) {
        const existing = await trx
          .selectFrom('giveaways')
          .selectAll()
          .where('store', '=', store)
          .where('external_id', '=', giveaway.externalId)
          .executeTakeFirst();
        const values = {
          id: existing?.id ?? randomUUID(),
          store,
          external_id: giveaway.externalId,
          title: giveaway.title,
          url: giveaway.url,
          image_url: giveaway.imageUrl ?? null,
          image_urls: giveaway.imageUrls ? JSON.stringify(giveaway.imageUrls.slice(0, 5)) : null,
          description: giveaway.description ?? null,
          description_en: giveaway.descriptions?.en ?? giveaway.description ?? null,
          description_ru: giveaway.descriptions?.ru ?? null,
          original_price: giveaway.originalPrice ?? null,
          currency: giveaway.currency ?? null,
          starts_at: giveaway.startsAt?.toISOString() ?? null,
          ends_at: giveaway.endsAt?.toISOString() ?? null,
          kind: giveaway.kind,
          first_seen_at: existing?.first_seen_at ?? timestamp,
          last_checked_at: timestamp,
          active: 1,
          notification_eligible: existing?.notification_eligible ?? (bootstrapped ? 1 : 0),
        };
        await trx
          .insertInto('giveaways')
          .values(values)
          .onConflict((conflict) =>
            conflict.columns(['store', 'external_id']).doUpdateSet({
              title: values.title,
              url: values.url,
              image_url: values.image_url,
              image_urls: values.image_urls,
              description: values.description,
              description_en: values.description_en,
              description_ru: values.description_ru,
              original_price: values.original_price,
              currency: values.currency,
              starts_at: values.starts_at,
              ends_at: values.ends_at,
              last_checked_at: timestamp,
              active: 1,
            }),
          )
          .execute();
        if (!existing && bootstrapped) {
          const inserted = await trx
            .selectFrom('giveaways')
            .selectAll()
            .where('store', '=', store)
            .where('external_id', '=', giveaway.externalId)
            .executeTakeFirstOrThrow();
          fresh.push(toDomain(inserted));
        }
      }
      let inactiveQuery = trx
        .updateTable('giveaways')
        .set({ active: 0, last_checked_at: timestamp })
        .where('store', '=', store);
      if (giveaways.length > 0)
        inactiveQuery = inactiveQuery.where(
          'external_id',
          'not in',
          giveaways.map((item) => item.externalId),
        );
      await inactiveQuery.execute();
      await trx
        .insertInto('app_state')
        .values({ key: bootstrapKey, value: 'true', updated_at: timestamp })
        .onConflict((conflict) =>
          conflict.column('key').doUpdateSet({ value: 'true', updated_at: timestamp }),
        )
        .execute();
      return { fresh, bootstrapped };
    });
  }

  async activeGiveaways(now = new Date()): Promise<StoredGiveaway[]> {
    const rows = await this.db
      .selectFrom('giveaways')
      .selectAll()
      .where('active', '=', 1)
      .where((expression) =>
        expression.or([
          expression('ends_at', 'is', null),
          expression('ends_at', '>', now.toISOString()),
        ]),
      )
      .orderBy('ends_at', 'asc')
      .execute();
    return rows.map(toDomain);
  }

  async findGiveaway(store: Store, externalId: string): Promise<StoredGiveaway | undefined> {
    const row = await this.db
      .selectFrom('giveaways')
      .selectAll()
      .where('store', '=', store)
      .where('external_id', '=', externalId)
      .executeTakeFirst();
    return row ? toDomain(row) : undefined;
  }

  async notificationEligibleGiveaways(now = new Date()): Promise<StoredGiveaway[]> {
    const rows = await this.db
      .selectFrom('giveaways')
      .selectAll()
      .where('active', '=', 1)
      .where('notification_eligible', '=', 1)
      .where((expression) =>
        expression.or([
          expression('ends_at', 'is', null),
          expression('ends_at', '>', now.toISOString()),
        ]),
      )
      .execute();
    return rows.map(toDomain);
  }

  async wasDelivered(giveawayId: string, chatId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('deliveries')
      .select('status')
      .where('giveaway_id', '=', giveawayId)
      .where('chat_id', '=', chatId)
      .executeTakeFirst();
    return row?.status === 'sent';
  }

  async recordDelivery(
    giveawayId: string,
    chatId: string,
    success: boolean,
    error?: string,
    now = new Date(),
  ): Promise<void> {
    const status = success ? 'sent' : 'failed';
    const sentAt = success ? now.toISOString() : null;
    await this.db
      .insertInto('deliveries')
      .values({
        id: randomUUID(),
        giveaway_id: giveawayId,
        chat_id: chatId,
        status,
        sent_at: sentAt,
        attempts: 1,
        last_error: error?.slice(0, 1000) ?? null,
      })
      .onConflict((conflict) =>
        conflict.columns(['giveaway_id', 'chat_id']).doUpdateSet((eb) => ({
          status,
          sent_at: sentAt,
          attempts: eb('deliveries.attempts', '+', 1),
          last_error: error?.slice(0, 1000) ?? null,
        })),
      )
      .execute();
  }
}
