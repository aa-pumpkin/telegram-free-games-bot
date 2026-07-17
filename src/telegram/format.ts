import type { Giveaway, Language } from '../domain/giveaway.js';
import { storeNames } from '../domain/giveaway.js';
import { t } from './i18n.js';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatPrice(giveaway: Giveaway, language: Language): string | undefined {
  if (giveaway.originalPrice === undefined) return undefined;
  if (giveaway.currency) {
    try {
      return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        style: 'currency',
        currency: giveaway.currency,
      }).format(giveaway.originalPrice);
    } catch {
      /* Unknown currency: fall through to a plain value. */
    }
  }
  return language === 'ru'
    ? String(giveaway.originalPrice).replace('.', ',')
    : String(giveaway.originalPrice);
}

function formatDate(date: Date, timezone: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

export function formatGiveaway(
  giveaway: Giveaway,
  timezone: string,
  language: Language,
  maxLength = 1000,
): string {
  const text = t(language);
  const lines = [
    `<b>${escapeHtml(giveaway.title)}</b>`,
    '',
    `${text.store}: ${storeNames[giveaway.store]}`,
  ];
  const price = formatPrice(giveaway, language);
  if (price) lines.push(`${text.regularPrice}: ${escapeHtml(price)}`);
  if (giveaway.endsAt)
    lines.push(`${text.freeUntil}: ${escapeHtml(formatDate(giveaway.endsAt, timezone, language))}`);
  else lines.push(text.noEndDate);
  const description =
    language === 'ru'
      ? giveaway.descriptions?.ru
      : (giveaway.descriptions?.en ?? giveaway.description);
  if (description) lines.push('', escapeHtml(description.trim()));
  const value = lines.join('\n');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
