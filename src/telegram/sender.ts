import { GrammyError, type Bot } from 'grammy';
import { uniqueImageUrls, type Giveaway, type Language } from '../domain/giveaway.js';
import type { Logger } from '../logger.js';
import { escapeHtml, formatGiveaway } from './format.js';
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
    if (images.length >= 2) {
      const albumResult = await this.sendAlbum(chatId, images, giveaway, language);
      if (albumResult) return albumResult;
    }
    for (const image of images) {
      try {
        await this.bot.api.sendPhoto(chatId, image, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return { success: true, blocked: false };
      } catch (error) {
        if (blockedByUser(error)) return { success: false, blocked: true, error: errorText(error) };
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

  private async sendAlbum(
    chatId: string,
    images: string[],
    giveaway: Giveaway,
    language: Language,
  ): Promise<SendResult | undefined> {
    const caption = `${formatGiveaway(giveaway, this.timezone, language, 900)}\n\n<a href="${escapeHtml(giveaway.url)}">${escapeHtml(t(language).claim)}</a>`;
    for (let count = images.length; count >= 2; count -= 1) {
      const selected = images.slice(0, count);
      const firstImage = selected[0];
      if (!firstImage) continue;
      try {
        await this.bot.api.sendMediaGroup(
          chatId,
          selected.map((media, index) =>
            index === 0
              ? { type: 'photo' as const, media, caption, parse_mode: 'HTML' as const }
              : { type: 'photo' as const, media },
          ),
        );
        return { success: true, blocked: false };
      } catch (error) {
        if (blockedByUser(error)) return { success: false, blocked: true, error: errorText(error) };
        this.logger.warn(
          { chatId, store: giveaway.store, imageCount: count, error: errorText(error) },
          'Не удалось отправить альбом, количество изображений уменьшается',
        );
      }
    }
    return undefined;
  }
}
