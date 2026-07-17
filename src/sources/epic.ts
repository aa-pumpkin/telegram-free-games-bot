import { z } from 'zod';
import type { Giveaway, GiveawaySource, SourceResult } from '../domain/giveaway.js';
import type { HttpClient } from '../http.js';

const promotionSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  discountSetting: z.object({ discountPercentage: z.number() }),
});
const elementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  offerType: z.string().optional(),
  productSlug: z.string().nullable().optional(),
  urlSlug: z.string().optional(),
  keyImages: z.array(z.object({ type: z.string(), url: z.string() })).default([]),
  categories: z.array(z.object({ path: z.string() })).default([]),
  catalogNs: z
    .object({
      mappings: z
        .array(z.object({ pageSlug: z.string(), pageType: z.string() }))
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  price: z
    .object({
      totalPrice: z.object({
        originalPrice: z.number(),
        discountPrice: z.number(),
        currencyCode: z.string(),
        currencyInfo: z.object({ decimals: z.number() }),
      }),
    })
    .optional(),
  promotions: z
    .object({
      promotionalOffers: z
        .array(z.object({ promotionalOffers: z.array(promotionSchema) }))
        .default([]),
    })
    .nullable()
    .optional(),
});
const responseSchema = z.object({
  data: z.object({
    Catalog: z.object({ searchStore: z.object({ elements: z.array(elementSchema) }) }),
  }),
});

export function parseEpicResponse(input: unknown, now = new Date()): Giveaway[] {
  const elements = responseSchema.parse(input).data.Catalog.searchStore.elements;
  const output: Giveaway[] = [];
  for (const element of elements) {
    const promotion = element.promotions?.promotionalOffers
      .flatMap((group) => group.promotionalOffers)
      .find(
        (item) =>
          item.discountSetting.discountPercentage === 0 &&
          new Date(item.startDate) <= now &&
          new Date(item.endDate) > now,
      );
    const price = element.price?.totalPrice;
    if (!promotion || !price || price.originalPrice <= 0 || price.discountPrice !== 0) continue;
    if (element.offerType && !['BASE_GAME', 'BUNDLE'].includes(element.offerType)) continue;
    if (!element.categories.some((category) => category.path === 'games')) continue;
    const pageSlug =
      element.catalogNs?.mappings?.find((mapping) => mapping.pageType === 'productHome')
        ?.pageSlug ??
      element.productSlug ??
      element.urlSlug;
    if (!pageSlug) continue;
    const imageUrl =
      element.keyImages.find((image) => image.type === 'OfferImageWide')?.url ??
      element.keyImages.find((image) => image.type === 'Thumbnail')?.url;
    const item: Giveaway = {
      externalId: element.id,
      title: element.title,
      store: 'epic',
      url: `https://store.epicgames.com/en-US/p/${pageSlug}`,
      originalPrice: price.originalPrice / 10 ** price.currencyInfo.decimals,
      currency: price.currencyCode,
      startsAt: new Date(promotion.startDate),
      endsAt: new Date(promotion.endDate),
      kind: 'keep-forever',
    };
    if (element.description) item.description = element.description;
    if (imageUrl?.startsWith('http')) item.imageUrl = imageUrl;
    output.push(item);
  }
  return output;
}

export class EpicSource implements GiveawaySource {
  readonly store = 'epic' as const;
  constructor(
    private readonly http: HttpClient,
    private readonly country: string,
    private readonly locale: string,
  ) {}
  async fetch(now = new Date()): Promise<SourceResult> {
    const [englishData, russianResult] = await Promise.all([
      this.fetchLocale(this.locale),
      this.fetchLocale('ru').catch(() => undefined),
    ]);
    const english = parseEpicResponse(englishData, now);
    const russian = russianResult ? parseEpicResponse(russianResult, now) : [];
    const russianById = new Map(russian.map((giveaway) => [giveaway.externalId, giveaway]));
    const giveaways = english.map((giveaway) => {
      const russianDescription = russianById.get(giveaway.externalId)?.description;
      const descriptions: NonNullable<Giveaway['descriptions']> = {};
      if (giveaway.description) descriptions.en = giveaway.description;
      if (russianDescription && russianDescription !== giveaway.description)
        descriptions.ru = russianDescription;
      return Object.keys(descriptions).length > 0 ? { ...giveaway, descriptions } : giveaway;
    });
    return { store: this.store, giveaways, fetchedAt: now };
  }

  private async fetchLocale(locale: string): Promise<unknown> {
    const query = new URLSearchParams({
      locale,
      country: this.country,
      allowCountries: this.country,
    });
    return this.http(
      `https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?${query.toString()}`,
    );
  }
}
