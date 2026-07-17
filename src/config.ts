import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    TELEGRAM_BOT_TOKEN: z.string().min(20, 'TELEGRAM_BOT_TOKEN отсутствует или слишком короткий'),
    TIMEZONE: z
      .string()
      .default('Europe/Berlin')
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone });
          return true;
        } catch {
          return false;
        }
      }, 'TIMEZONE должен быть корректным IANA-часовым поясом'),
    DATABASE_URL: z
      .string()
      .default('sqlite://./data/bot.db')
      .refine(
        (value) =>
          value.startsWith('sqlite://') ||
          value.startsWith('postgres://') ||
          value.startsWith('postgresql://'),
        'DATABASE_URL должен начинаться с sqlite://, postgres:// или postgresql://',
      ),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    HTTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    HTTP_RETRY_DELAY_MS: z.coerce.number().int().min(50).max(10000).default(500),
    SEND_DELAY_MS: z.coerce.number().int().min(30).max(5000).default(100),
    GAMES_CACHE_TTL_MS: z.coerce.number().int().min(1000).max(3600000).default(300000),
    DELIVERY_START_HOUR: z.coerce.number().int().min(0).max(23).default(9),
    DELIVERY_END_HOUR: z.coerce.number().int().min(0).max(23).default(21),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    STORE_COUNTRY: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('DE'),
    STORE_LOCALE: z
      .string()
      .regex(/^[a-z]{2}-[A-Z]{2}$/)
      .default('en-US'),
  })
  .refine((config) => config.DELIVERY_START_HOUR <= config.DELIVERY_END_HOUR, {
    message: 'DELIVERY_START_HOUR должен быть меньше или равен DELIVERY_END_HOUR',
    path: ['DELIVERY_END_HOUR'],
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Ошибка конфигурации: ${details}`);
  }
  return result.data;
}
