export const stores = ['steam', 'epic', 'gog'] as const;
export type Store = (typeof stores)[number];
export const languages = ['ru', 'en'] as const;
export type Language = (typeof languages)[number];

export interface Giveaway {
  externalId: string;
  title: string;
  store: Store;
  url: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  descriptions?: Partial<Record<Language, string>>;
  originalPrice?: number;
  currency?: string;
  startsAt?: Date;
  endsAt?: Date;
  kind: 'keep-forever';
}

export interface SourceResult {
  store: Store;
  giveaways: Giveaway[];
  fetchedAt: Date;
}

export interface GiveawaySource {
  readonly store: Store;
  fetch(now?: Date): Promise<SourceResult>;
}

const excludedPattern =
  /\b(dlc|downloadable content|demo|prologue|soundtrack|ost|weekend|free weekend|trial|playtest|beta|currency|coins?|points?|subscription|season pass|artbook|avatar|skin|pack)\b/i;

export function isEligibleGiveaway(giveaway: Giveaway, now = new Date()): boolean {
  if (giveaway.endsAt && giveaway.endsAt <= now) return false;
  if (giveaway.startsAt && giveaway.startsAt > now) return false;
  if (giveaway.originalPrice !== undefined && giveaway.originalPrice <= 0) return false;
  return !excludedPattern.test(
    `${giveaway.title} ${giveaway.description ?? ''} ${Object.values(giveaway.descriptions ?? {}).join(' ')}`,
  );
}

export function deduplicateGiveaways(giveaways: Giveaway[]): Giveaway[] {
  const unique = new Map<string, Giveaway>();
  for (const giveaway of giveaways) {
    const key = `${giveaway.store}:${giveaway.externalId}`;
    if (!unique.has(key)) unique.set(key, giveaway);
  }
  return [...unique.values()];
}

export function uniqueImageUrls(...groups: Array<Array<string | undefined>>): string[] {
  return [
    ...new Set(
      groups
        .flat()
        .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)),
    ),
  ].slice(0, 5);
}

export const storeNames: Record<Store, string> = {
  steam: 'Steam',
  epic: 'Epic Games Store',
  gog: 'GOG',
};
