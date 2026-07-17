import { z } from 'zod';
import type { Giveaway, GiveawaySource, SourceResult } from '../domain/giveaway.js';
import type { HttpClient } from '../http.js';

const responseSchema = z.object({
  success: z.number(),
  results_html: z.string(),
  total_count: z.number(),
});

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseLocalizedPrice(value: string): { amount: number; currency?: string } | undefined {
  const normalized = value.replace(/[^\d,.]/g, '').replace(/,(?=\d{2}$)/, '.');
  const amount = Number.parseFloat(normalized.replace(/,(?=\d{3}(?:\D|$))/g, ''));
  if (!Number.isFinite(amount)) return undefined;
  const currency = value.includes('€')
    ? 'EUR'
    : value.includes('$')
      ? 'USD'
      : value.includes('£')
        ? 'GBP'
        : undefined;
  return currency ? { amount, currency } : { amount };
}

export function parseSteamResponse(input: unknown, now = new Date()): Giveaway[] {
  const { results_html: html } = responseSchema.parse(input);
  const rows = html.match(/<a\s+href="[\s\S]*?<\/a>/g) ?? [];
  const giveaways: Giveaway[] = [];
  for (const row of rows) {
    const appId = /data-ds-appid="(\d+)"/.exec(row)?.[1];
    const href = /href="([^"]+)"/.exec(row)?.[1];
    const title = /<span class="title">([\s\S]*?)<\/span>/.exec(row)?.[1];
    const imageUrl = /<div class="search_capsule"><img src="([^"]+)"/.exec(row)?.[1];
    const discount = /data-discount="(\d+)"/.exec(row)?.[1];
    const originalText = /<div class="discount_original_price">([\s\S]*?)<\/div>/.exec(row)?.[1];
    if (!appId || !href || !title || discount !== '100' || !originalText) continue;
    const original = parseLocalizedPrice(decodeHtml(originalText));
    if (!original || original.amount <= 0) continue;
    const cleanTitle = decodeHtml(title.replace(/<[^>]*>/g, '').trim());
    if (/\b(demo|dlc|soundtrack|prologue|playtest|free weekend)\b/i.test(cleanTitle)) continue;
    const url = new URL(decodeHtml(href));
    url.search = '';
    const item: Giveaway = {
      externalId: appId,
      title: cleanTitle,
      store: 'steam',
      url: url.toString(),
      originalPrice: original.amount,
      startsAt: now,
      kind: 'keep-forever',
    };
    if (imageUrl) item.imageUrl = decodeHtml(imageUrl);
    if (original.currency) item.currency = original.currency;
    giveaways.push(item);
  }
  return giveaways;
}

export class SteamSource implements GiveawaySource {
  readonly store = 'steam' as const;
  constructor(
    private readonly http: HttpClient,
    private readonly country: string,
  ) {}

  async fetch(now = new Date()): Promise<SourceResult> {
    const parameters = new URLSearchParams({
      query: '',
      start: '0',
      count: '100',
      dynamic_data: '',
      sort_by: '_ASC',
      specials: '1',
      maxprice: 'free',
      category1: '998',
      infinite: '1',
      cc: this.country.toLowerCase(),
      l: 'english',
    });
    const data = await this.http(
      `https://store.steampowered.com/search/results/?${parameters.toString()}`,
    );
    return { store: this.store, giveaways: parseSteamResponse(data, now), fetchedAt: now };
  }
}
