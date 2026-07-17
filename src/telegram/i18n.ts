import type { Language, Store } from '../domain/giveaway.js';
import { storeNames } from '../domain/giveaway.js';

const messages = {
  ru: {
    languagePrompt: 'Выберите язык бота:',
    languageChanged: 'Язык изменён на русский.',
    started:
      'Готово! Автоматические уведомления включены. Используйте /games, чтобы увидеть текущие раздачи.',
    stopped: 'Автоматические уведомления отключены. Команда /games по-прежнему доступна.',
    statusOn: 'Автоматические уведомления включены.',
    statusOff: 'Автоматические уведомления отключены.',
    checking: 'Проверяю актуальные раздачи…',
    noGames: 'Сейчас активных бесплатных раздач для Steam, Epic Games Store и GOG не найдено.',
    sourceFailure: '⚠️ Не удалось обновить данные',
    help: [
      '/start — включить уведомления',
      '/stop — отключить уведомления',
      '/games — текущие раздачи',
      '/status — состояние подписки',
      '/language — сменить язык',
      '/help — помощь',
    ].join('\n'),
    newGame: 'Новая бесплатная игра',
    freeGame: 'Бесплатная игра',
    store: 'Магазин',
    regularPrice: 'Обычная цена',
    freeUntil: 'Бесплатно до',
    noEndDate: 'Срок окончания: не указан магазином',
    claim: 'Забрать игру',
  },
  en: {
    languagePrompt: 'Choose the bot language:',
    languageChanged: 'Language changed to English.',
    started: 'Done! Automatic notifications are enabled. Use /games to see current giveaways.',
    stopped: 'Automatic notifications are disabled. You can still use /games.',
    statusOn: 'Automatic notifications are enabled.',
    statusOff: 'Automatic notifications are disabled.',
    checking: 'Checking current giveaways…',
    noGames: 'No active free game giveaways were found for Steam, Epic Games Store, or GOG.',
    sourceFailure: '⚠️ Could not update data from',
    help: [
      '/start — enable notifications',
      '/stop — disable notifications',
      '/games — current giveaways',
      '/status — subscription status',
      '/language — change language',
      '/help — help',
    ].join('\n'),
    newGame: 'New free game',
    freeGame: 'Free game',
    store: 'Store',
    regularPrice: 'Regular price',
    freeUntil: 'Free until',
    noEndDate: 'End date: not provided by the store',
    claim: 'Claim game',
  },
} as const;

export function t(language: Language) {
  return messages[language];
}

export function sourceFailureMessage(stores: Store[], language: Language): string {
  if (stores.length === 0) return '';
  return `\n\n${t(language).sourceFailure}: ${stores.map((store) => storeNames[store]).join(', ')}.`;
}
