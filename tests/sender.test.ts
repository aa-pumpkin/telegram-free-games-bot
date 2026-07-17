import type { Bot } from 'grammy';
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/logger.js';
import { TelegramSender } from '../src/telegram/sender.js';

describe('TelegramSender', () => {
  it('sends up to five images as one album with text below it', async () => {
    const sendPhoto = vi.fn().mockResolvedValue({});
    const sendMediaGroup = vi
      .fn<(chatId: string, media: Array<Record<string, unknown>>) => Promise<Array<unknown>>>()
      .mockResolvedValue([]);
    const sendMessage = vi.fn().mockResolvedValue({});
    const bot = { api: { sendPhoto, sendMediaGroup, sendMessage } } as unknown as Bot;
    const sender = new TelegramSender(
      bot,
      'Europe/Berlin',
      createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' }),
    );
    const result = await sender.send(
      '42',
      {
        externalId: '1',
        title: 'Game',
        store: 'steam',
        url: 'https://store.test/game',
        imageUrls: Array.from({ length: 7 }, (_, index) => `https://img.test/${index}.jpg`),
        kind: 'keep-forever',
      },
      'en',
    );

    expect(result.success).toBe(true);
    expect(sendPhoto).not.toHaveBeenCalled();
    expect(sendMediaGroup).toHaveBeenCalledOnce();
    expect(sendMediaGroup.mock.calls[0]?.[1]).toHaveLength(5);
    expect(sendMediaGroup.mock.calls[0]?.[1]?.[0]).toEqual(
      expect.objectContaining({
        media: 'https://img.test/0.jpg',
        parse_mode: 'HTML',
        caption: expect.stringContaining('Claim game') as string,
      }),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
