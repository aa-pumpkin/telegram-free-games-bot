# Free Games Telegram Bot

A Telegram bot that notifies users about limited-time free PC games from:

- Steam
- Epic Games Store
- GOG

The bot supports Russian and English. Users choose their language when they first run `/start` and can change it later with `/language`.

## Features

- Checks stores at startup, 00:00, and 12:00
- Sends each giveaway only once per user
- Supports multiple users
- Stores only the Telegram chat ID and selected language
- Retries temporary network errors

The first successful store check is saved without sending old giveaways. Only newly discovered games are sent automatically.

## Commands

- `/start` — choose a language and enable notifications
- `/stop` — disable notifications
- `/games` — show current giveaways
- `/status` — show notification status
- `/language` — change language
- `/help` — show available commands

## Requirements

- Node.js 22 LTS
- npm
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Quick Start

```bash
git clone <repository-url>
cd tg-games
npm install
cp .env.example .env
```

Run the database migration and start the bot:

```bash
npm run db:migrate
npm run dev
```

Open your bot in Telegram and send `/start`.

## Production

```bash
npm run build
npm start
```

## Tests

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Docker

```bash
docker compose up --build -d
docker compose logs -f bot
docker compose down
```

The Compose configuration uses a persistent volume for the local SQLite database.

Health endpoint:

```text
http://localhost:3000/health
```

## PostgreSQL

For hosting platforms with an ephemeral filesystem, use PostgreSQL instead of SQLite:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Migrations run automatically when the application starts.

## Data Sources

- Steam: official Steam Store search endpoint
- Epic Games Store: official storefront promotions endpoint
- GOG: official catalog endpoint

Steam and GOG do not always provide an exact giveaway end date. In that case, a giveaway remains active until it disappears from the next successful store check.

Epic descriptions are requested in English and Russian. If a Russian description is unavailable, the bot omits it instead of mixing languages.

## Privacy

The bot stores only:

- Telegram chat ID
- Selected bot language
- Subscription status and timestamps
- Giveaway and delivery records

It does not store names, usernames, phone numbers, profile data, message text, or Telegram profile language.
