import { GrammyError, type Bot } from 'grammy';
import type { Logger } from '../logger.js';

const TOKEN_IN_URL = /bot\d+:[^/\s]+/gi;

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener('abort', done, { once: true });
  });
}

export function safeTelegramError(error: unknown): string {
  if (error instanceof GrammyError) return `Telegram API ${error.error_code}: ${error.description}`;
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(TOKEN_IN_URL, 'bot[REDACTED]');
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof GrammyError)) return true;
  return error.error_code === 409 || error.error_code === 429 || error.error_code >= 500;
}

export async function keepBotRunning(
  bot: { start: Bot['start'] },
  signal: AbortSignal,
  logger: Logger,
  retryDelayMs = 5000,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await bot.start({
        onStart: (information) =>
          logger.info({ username: information.username }, 'Telegram-бот запущен'),
      });
      if (!signal.aborted) logger.warn('Telegram polling неожиданно остановился');
    } catch (error) {
      if (signal.aborted) return;
      if (!isRetryable(error)) throw error;
      logger.warn(
        { error: safeTelegramError(error), retryDelayMs },
        'Не удалось запустить Telegram polling; следующая попытка будет выполнена автоматически',
      );
    }
    await wait(retryDelayMs, signal);
  }
}

export async function retryTelegramSetup(
  operation: () => Promise<void>,
  signal: AbortSignal,
  logger: Logger,
  retryDelayMs = 30000,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await operation();
      return;
    } catch (error) {
      if (signal.aborted) return;
      if (!isRetryable(error)) {
        logger.error(
          { error: safeTelegramError(error) },
          'Команды Telegram не обновлены из-за постоянной ошибки',
        );
        return;
      }
      logger.warn(
        { error: safeTelegramError(error), retryDelayMs },
        'Не удалось обновить команды Telegram; следующая попытка будет выполнена автоматически',
      );
      await wait(retryDelayMs, signal);
    }
  }
}
