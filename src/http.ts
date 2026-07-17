import type { Logger } from './logger.js';

export interface HttpOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  logger: Logger;
  fetchImpl?: typeof fetch;
}

const retryStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createHttpClient(options: HttpOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async function request(url: string): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(options.timeoutMs),
          headers: { 'user-agent': 'telegram-free-games-bot/1.0 (+https://github.com/)' },
        });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status} для ${new URL(url).hostname}`);
          if (!retryStatuses.has(response.status)) throw error;
          lastError = error;
        } else {
          return await response.json();
        }
      } catch (error) {
        lastError = error;
        if (
          error instanceof Error &&
          error.message.startsWith('HTTP ') &&
          ![...retryStatuses].some((s) => error.message.startsWith(`HTTP ${s}`))
        )
          throw error;
      }
      if (attempt < options.retries) {
        options.logger.warn(
          { host: new URL(url).hostname, attempt: attempt + 1 },
          'Временная HTTP-ошибка, повтор запроса',
        );
        await wait(options.retryDelayMs * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Неизвестная HTTP-ошибка');
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
