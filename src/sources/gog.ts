import { z } from 'zod';
import {
  uniqueImageUrls,
  type Giveaway,
  type GiveawaySource,
  type SourceResult,
} from '../domain/giveaway.js';
import type { HttpClient } from '../http.js';

const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  productType: z.string(),
  title: z.string(),
  coverHorizontal: z.string().optional(),
  screenshots: z.array(z.string()).default([]),
  storeLink: z.string().url(),
  tags: z.array(z.object({ name: z.string(), slug: z.string() })).default([]),
  price: z.object({
    finalMoney: z.object({ amount: z.string(), currency: z.string() }),
    baseMoney: z.object({ amount: z.string(), currency: z.string() }),
    discount: z.string(),
  }),
});
const responseSchema = z.object({ products: z.array(productSchema) });

export function parseGogResponse(input: unknown): Giveaway[] {
  const products = responseSchema.parse(input).products;
  const output: Giveaway[] = [];
  for (const product of products) {
    const base = Number.parseFloat(product.price.baseMoney.amount);
    const final = Number.parseFloat(product.price.finalMoney.amount);
    if (product.productType !== 'game' || !Number.isFinite(base) || base <= 0 || final !== 0)
      continue;
    if (product.price.discount !== '-100%') continue;
    if (product.tags.some((tag) => ['demo', 'freegame', 'mod', 'ost'].includes(tag.slug))) continue;
    const item: Giveaway = {
      externalId: product.id,
      title: product.title,
      store: 'gog',
      url: product.storeLink,
      originalPrice: base,
      currency: product.price.baseMoney.currency,
      kind: 'keep-forever',
    };
    const imageUrls = uniqueImageUrls(
      [product.coverHorizontal],
      product.screenshots.map((url) =>
        url.replace('{formatter}', 'product_card_v2_mobile_slider_639'),
      ),
    );
    if (imageUrls[0]) item.imageUrl = imageUrls[0];
    if (imageUrls.length > 0) item.imageUrls = imageUrls;
    output.push(item);
  }
  return output;
}

export class GogSource implements GiveawaySource {
  readonly store = 'gog' as const;
  constructor(private readonly http: HttpClient) {}
  async fetch(now = new Date()): Promise<SourceResult> {
    const query = new URLSearchParams({
      limit: '48',
      order: 'desc:trending',
      discounted: 'eq:true',
      price: 'between:0,0',
      productType: 'in:game,pack',
    });
    const data = await this.http(`https://catalog.gog.com/v1/catalog?${query.toString()}`);
    return { store: this.store, giveaways: parseGogResponse(data), fetchedAt: now };
  }
}
