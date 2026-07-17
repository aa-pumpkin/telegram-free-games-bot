import { describe, expect, it } from 'vitest';
import { escapeHtml, formatGiveaway } from '../src/telegram/format.js';

describe('Telegram formatting', () => {
  it('escapes all unsafe HTML characters', () =>
    expect(escapeHtml('<b a="x">&')).toBe('&lt;b a=&quot;x&quot;&gt;&amp;'));
  it('formats and truncates a giveaway safely', () => {
    const text = formatGiveaway(
      {
        externalId: '1',
        title: '<Control>',
        store: 'epic',
        url: 'https://example.com',
        descriptions: { ru: 'я'.repeat(3000), en: 'x'.repeat(3000) },
        originalPrice: 29.99,
        currency: 'EUR',
        endsAt: new Date('2026-07-20T15:00:00Z'),
        kind: 'keep-forever',
      },
      'Europe/Berlin',
      'ru',
      true,
      1000,
    );
    expect(text).toContain('&lt;Control&gt;');
    expect(text).toContain('Epic Games Store');
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text.endsWith('…')).toBe(true);
  });

  it('formats an entirely English message', () => {
    const text = formatGiveaway(
      {
        externalId: '1',
        title: 'Control',
        store: 'epic',
        url: 'https://example.com',
        descriptions: { ru: 'Русское описание', en: 'English description' },
        originalPrice: 29.99,
        currency: 'EUR',
        endsAt: new Date('2026-07-20T15:00:00Z'),
        kind: 'keep-forever',
      },
      'Europe/Berlin',
      'en',
      true,
    );
    expect(text).toContain('New free game');
    expect(text).toContain('Store: Epic Games Store');
    expect(text).toContain('English description');
    expect(text).not.toContain('Русское описание');
  });
});
