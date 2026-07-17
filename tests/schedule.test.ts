import { describe, expect, it } from 'vitest';
import { isDeliveryTime, localHour } from '../src/schedule.js';

describe('notification schedule', () => {
  it('uses the configured timezone', () => {
    expect(localHour(new Date('2026-01-15T08:00:00Z'), 'Europe/Berlin')).toBe(9);
  });

  it('allows delivery from 09:00 through 21:00 inclusive', () => {
    expect(isDeliveryTime(new Date('2026-01-15T08:00:00Z'), 'Europe/Berlin', 9, 21)).toBe(true);
    expect(isDeliveryTime(new Date('2026-01-15T20:00:00Z'), 'Europe/Berlin', 9, 21)).toBe(true);
  });

  it('blocks delivery during the night', () => {
    expect(isDeliveryTime(new Date('2026-01-15T07:00:00Z'), 'Europe/Berlin', 9, 21)).toBe(false);
    expect(isDeliveryTime(new Date('2026-01-15T21:00:00Z'), 'Europe/Berlin', 9, 21)).toBe(false);
  });
});
