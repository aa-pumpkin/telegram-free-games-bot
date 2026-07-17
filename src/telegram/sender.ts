import { GrammyError, type Bot } from 'grammy';
import { uniqueImageUrls, type Giveaway, type Language } from '../domain/giveaway.js';
import type { Logger } from '../logger.js';
import { formatGiveaway } from './format.js';
import { t } from './i18n.js';

export interface SendResult {
  success: boolean;
  blocked: boolean;
  error?: string;
}
export interface GiveawaySender {
  send(chatId: string, giveaway: Giveaway, language: Language): Promise<SendResult>;
}

function blockedByUser(error: unknown): boolean {
  return error instanceof GrammyError && error.error_code === 403;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class TelegramSender implements GiveawaySender {
  constructor(
    private readonly bot: Bot,
    private readonly timezone: string,
    private readonly logger: Logger,
  ) {}

  async send(chatId: string, giveaway: Giveaway, language: Language): Promise<SendResult> {
    const keyboard = { inline_keyboard: [[{ text: t(language).claim, url: giveaway.url }]] };
    const caption = formatGiveaway(giveaway, this.timezone, language, 1000);
    const images = uniqueImageUrls(giveaway.imageUrls ?? [], [giveaway.imageUrl]);
    const failedImages = new Set<string>();
    for (const image of images) {
      try {
        await this.bot.api.sendPhoto(chatId, image, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await this.sendAdditionalImages(
          chatId,
          images.filter((candidate) => candidate !== image && !failedImages.has(candidate)),
          giveaway,
        );
        return { success: true, blocked: false };
      } catch (error) {
        if (blockedByUser(error)) return { success: false, blocked: true, error: errorText(error) };
        failedImages.add(image);
        this.logger.warn(
          { chatId, store: giveaway.store, error: errorText(error) },
          'Не удалось отправить изображение, пробуется следующее',
        );
      }
    }
    try {
      await this.bot.api.sendMessage(
        chatId,
        formatGiveaway(giveaway, this.timezone, language, 3900),
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        },
      );
      return { success: true, blocked: false };
    } catch (error) {
      return { success: false, blocked: blockedByUser(error), error: errorText(error) };
    }
  }

  private async sendAdditionalImages(
    chatId: string,
    images: string[],
    giveaway: Giveaway,
  ): Promise<void> {
    if (images.length === 0) return;
    try {
      if (images.length === 1) {
        await this.bot.api.sendPhoto(chatId, images[0]!);
      } else {
        await this.bot.api.sendMediaGroup(
          chatId,
          images.map((media) => ({ type: 'photo' as const, media })),
        );
      }
    } catch (error) {
      this.logger.warn(
        { chatId, store: giveaway.store, error: errorText(error) },
        'Основное сообщение отправлено, но дополнительные изображения недоступны',
      );
    }
  }
}
