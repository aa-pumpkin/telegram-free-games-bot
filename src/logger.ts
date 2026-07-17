import pino from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>) {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: ['token', 'TELEGRAM_BOT_TOKEN', '*.token', '*.TELEGRAM_BOT_TOKEN'],
      censor: '[REDACTED]',
    },
    ...(config.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }
      : {}),
  });
}

export type Logger = ReturnType<typeof createLogger>;
