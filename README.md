# Free Games Telegram Bot

Telegram bot for Steam, Epic Games Store, and GOG giveaways.

[Open the bot](https://t.me/tg_notifications_games_bot)

## Features

- Checks stores every hour and sends each giveaway once
- Delivers notifications between 09:00 and 21:00
- Supports English and Russian
- Works in private chats and groups
- Sends up to five store images with each game

## Commands

- `/start` — enable notifications
- `/games` — show current giveaways
- `/stop` — disable notifications
- `/language` — change language
- `/status` — check subscription status

In groups, only administrators can change the language or subscription settings.

## Run locally

Requires Node.js 22 and a bot token from [@BotFather](https://t.me/BotFather).

```bash
git clone https://github.com/aa-pumpkin/telegram-free-games-bot.git
cd telegram-free-games-bot
npm install
cp .env.example .env
```

Add your token to `.env`, then run:

```bash
npm run dev
```

The project supports SQLite locally and PostgreSQL in production. It is ready for Docker deployment and exposes `/health` for health checks.

## License

MIT
