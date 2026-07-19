import { GrammyError } from 'grammy';
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/logger.js';
import { keepBotRunning, safeTelegramError } from '../src/telegram/runtime.js';

describe('Telegram runtime', () => {
  it('redacts bot tokens from network errors', () => {
    const error = new Error(
      'request to https://api.telegram.org/bot123456:secret-value/setMyCommands failed',
    );
    expect(safeTelegramError(error)).toBe(
      'request to https://api.telegram.org/bot[REDACTED]/setMyCommands failed',
    );
  });

  it('does not include a token when formatting Telegram API errors', () => {
    const error = new GrammyError(
      "Call to 'getUpdates' failed!",
      { ok: false, error_code: 409, description: 'Conflict' },
      'getUpdates',
      {},
    );
    expect(safeTelegramError(error)).toBe('Telegram API 409: Conflict');
  });

  it('retries polling after a deployment conflict', async () => {
    const controller = new AbortController();
    const conflict = new GrammyError(
      "Call to 'getUpdates' failed!",
      { ok: false, error_code: 409, description: 'Conflict' },
      'getUpdates',
      {},
    );
    const start = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.resolve();
      });

    await keepBotRunning({ start }, controller.signal, logger(), 0);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not hide a permanently invalid token behind retries', async () => {
    const unauthorized = new GrammyError(
      "Call to 'getMe' failed!",
      { ok: false, error_code: 401, description: 'Unauthorized' },
      'getMe',
      {},
    );
    const start = vi.fn().mockRejectedValue(unauthorized);

    await expect(keepBotRunning({ start }, new AbortController().signal, logger(), 0)).rejects.toBe(
      unauthorized,
    );
    expect(start).toHaveBeenCalledOnce();
  });
});

function logger() {
  return createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });
}
