import type { Bot, Context } from 'grammy';
import type { Config } from '../config.js';
import type { Repository } from '../database/repository.js';
import type { Language } from '../domain/giveaway.js';
import type { Logger } from '../logger.js';
import type { CheckService } from '../services/check-service.js';
import { sourceFailureMessage, t } from './i18n.js';
import type { GiveawaySender } from './sender.js';

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function languageKeyboard(mode: 'start' | 'change') {
  return {
    inline_keyboard: [
      [
        { text: '🇷🇺 Русский', callback_data: `language:ru:${mode}` },
        { text: '🇬🇧 English', callback_data: `language:en:${mode}` },
      ],
    ],
  };
}

async function askForLanguage(context: Context, mode: 'start' | 'change'): Promise<void> {
  await context.reply('Выберите язык / Choose your language:', {
    reply_markup: languageKeyboard(mode),
  });
}

async function requireLanguage(
  context: Context,
  repository: Repository,
): Promise<Language | undefined> {
  if (!context.chat) return undefined;
  const language = await repository.getLanguage(String(context.chat.id));
  if (!language) await askForLanguage(context, 'change');
  return language;
}

export function registerBotHandlers(
  bot: Bot,
  config: Config,
  repository: Repository,
  checks: CheckService,
  sender: GiveawaySender,
  logger: Logger,
): void {
  bot.command('start', async (context) => {
    const chatId = String(context.chat.id);
    const language = await repository.getLanguage(chatId);
    if (!language) {
      await askForLanguage(context, 'start');
      return;
    }
    await repository.setSubscription(chatId, true);
    await context.reply(t(language).started);
  });

  bot.callbackQuery(/^language:(ru|en):(start|change)$/, async (context) => {
    if (!context.chat) return;
    const language = context.match[1] as Language;
    const mode = context.match[2] as 'start' | 'change';
    await repository.setLanguage(String(context.chat.id), language, mode === 'start');
    await context.answerCallbackQuery();
    await context.editMessageText(
      mode === 'start' ? t(language).started : t(language).languageChanged,
    );
  });

  bot.command(['language', 'lang'], async (context) => askForLanguage(context, 'change'));

  bot.command('stop', async (context) => {
    const language = await requireLanguage(context, repository);
    if (!language) return;
    await repository.setSubscription(String(context.chat.id), false);
    await context.reply(t(language).stopped);
  });

  bot.command('status', async (context) => {
    const language = await requireLanguage(context, repository);
    if (!language) return;
    const active = await repository.isSubscribed(String(context.chat.id));
    await context.reply(active ? t(language).statusOn : t(language).statusOff);
  });

  bot.command('help', async (context) => {
    const language = await requireLanguage(context, repository);
    if (language) await context.reply(t(language).help);
  });

  bot.command('games', async (context) => {
    const language = await requireLanguage(context, repository);
    if (!language) return;
    await context.reply(t(language).checking);
    const current = await checks.getCurrent();
    if (current.giveaways.length === 0) {
      await context.reply(
        t(language).noGames + sourceFailureMessage(current.failedStores, language),
      );
      return;
    }
    for (const giveaway of current.giveaways) {
      await sender.send(String(context.chat.id), giveaway, language, false);
      await pause(config.SEND_DELAY_MS);
    }
    if (current.failedStores.length > 0)
      await context.reply(sourceFailureMessage(current.failedStores, language).trim());
  });

  bot.catch((error) =>
    logger.error(
      { error: error.error instanceof Error ? error.error.message : String(error.error) },
      'Ошибка обработчика Telegram',
    ),
  );
}
