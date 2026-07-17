import { describe, expect, it } from 'vitest';
import { deduplicateGiveaways, isEligibleGiveaway, type Giveaway } from '../src/domain/giveaway.js';

const game = (overrides: Partial<Giveaway> = {}): Giveaway => ({
  externalId: '1',
  title: 'Paid Game',
  store: 'steam',
  url: 'https://example.com',
  originalPrice: 10,
  kind: 'keep-forever',
  ...overrides,
});

describe('giveaway filtering', () => {
  it('excludes ordinary free-to-play games', () =>
    expect(isEligibleGiveaway(game({ originalPrice: 0 }))).toBe(false));
  it('excludes DLC by title', () =>
    expect(isEligibleGiveaway(game({ title: 'Game DLC' }))).toBe(false));
  it('excludes free weekends', () =>
    expect(isEligibleGiveaway(game({ description: 'Free weekend access' }))).toBe(false));
  it('excludes ended promotions', () =>
    expect(isEligibleGiveaway(game({ endsAt: new Date('2020-01-01') }))).toBe(false));
  it('deduplicates by store and external id', () =>
    expect(deduplicateGiveaways([game(), game()])).toHaveLength(1));
  it('keeps equal ids from different stores', () =>
    expect(deduplicateGiveaways([game(), game({ store: 'gog' })])).toHaveLength(2));
});
