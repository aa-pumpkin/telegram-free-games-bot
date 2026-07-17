import cron from 'node-cron';
import { Bot } from 'grammy';
import { loadConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { migrateToLatest } from './database/migrate.js';
import { Repository } from './database/repository.js';
import { startHealthServer } from './health.js';
import { createHttpClient } from './http.js';
import { createLogger } from './logger.js';
import { CheckService } from './services/check-service.js';
import { EpicSource, GogSource, SteamSource } from './sources/index.js';
import { registerBotHandlers } from './telegram/bot.js';
import { TelegramSender } from './telegram/sender.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL);
await migrateToLatest(database);
const repository = new Repository(database);
const http = createHttpClient({
  timeoutMs: config.HTTP_TIMEOUT_MS,
  retries: config.HTTP_RETRIES,
  retryDelayMs: config.HTTP_RETRY_DELAY_MS,
  logger,
});
const sources = [
  new SteamSource(http, config.STORE_COUNTRY),
  new EpicSource(http, config.STORE_COUNTRY, config.STORE_LOCALE),
  new GogSource(http),
];
const activeBot = new Bot(config.TELEGRAM_BOT_TOKEN);
const sender = new TelegramSender(activeBot, config.TIMEZONE, logger);
const checks = new CheckService(
  sources,
  repository,
  sender,
  logger,
  config.SEND_DELAY_MS,
  config.GAMES_CACHE_TTL_MS,
);
registerBotHandlers(activeBot, config, repository, checks, sender, logger);
const healthServer = startHealthServer(config.PORT, logger);
const midnightTask = cron.schedule(
  '0 0 * * *',
  () => {
    void checks.run(false);
  },
  { timezone: config.TIMEZONE },
);
const noonTask = cron.schedule(
  '0 12 * * *',
  () => {
    void checks.run(true);
  },
  { timezone: config.TIMEZONE },
);
void checks.run(false);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Завершение приложения');
  await midnightTask.stop();
  await noonTask.stop();
  await activeBot.stop();
  healthServer.close();
  await database.destroy();
}
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

const englishCommands = [
  { command: 'start', description: 'Enable notifications' },
  { command: 'stop', description: 'Disable notifications' },
  { command: 'games', description: 'Current free games' },
  { command: 'status', description: 'Subscription status' },
  { command: 'language', description: 'Change language' },
  { command: 'help', description: 'Command list' },
];
await activeBot.api.setMyCommands(englishCommands);
await activeBot.api.setMyCommands(englishCommands, { language_code: 'en' });
await activeBot.api.setMyCommands(
  [
    { command: 'start', description: 'Включить уведомления' },
    { command: 'stop', description: 'Отключить уведомления' },
    { command: 'games', description: 'Текущие бесплатные игры' },
    { command: 'status', description: 'Состояние подписки' },
    { command: 'language', description: 'Сменить язык' },
    { command: 'help', description: 'Список команд' },
  ],
  { language_code: 'ru' },
);
await activeBot.start({
  onStart: (information) => logger.info({ username: information.username }, 'Telegram-бот запущен'),
});
