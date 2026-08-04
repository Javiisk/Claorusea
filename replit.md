# TitanBot

A feature-rich Discord bot built with Discord.js v14 and PostgreSQL. Includes moderation, economy, tickets, leveling, giveaways, reaction roles, and more.

## Stack

- **Runtime:** Node.js 18+ (ESM)
- **Discord:** discord.js v14
- **Database:** PostgreSQL (via `pg`)
- **Web API:** Express (port 3000, health/status endpoints)
- **Logging:** Winston

## How to Run

The bot starts automatically via the **"Start application"** workflow, which runs:

```
npm start
```

This runs `src/app.js`, which:
1. Connects to PostgreSQL and runs auto-migrations
2. Loads all slash commands from `src/commands/`
3. Registers commands with Discord
4. Starts the Express health API on port 3000
5. Logs in the Discord bot

## Required Secrets

Set these in Replit Secrets:

| Secret | Description |
|--------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Application (client) ID from Discord Developer Portal |
| `GUILD_ID` | Discord server ID to deploy commands to |
| `POSTGRES_URL` | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |

## Optional Secrets

| Secret | Description |
|--------|-------------|
| `BLOXLINK_API_KEY` | Bloxlink Roblox verification API |
| `ROBLOX_API_KEY` | Roblox API key |
| `ROBLOX_GROUP_ID` | Roblox group ID |
| `UNIVERSE_ID` | Roblox universe ID |
| `TRELLO_API_KEY` | Trello API key |
| `TRELLO_TOKEN` | Trello token |
| `TRELLO_BOARD_ID` | Main Trello board ID |

## Database Migrations

Migrations run automatically on startup (`AUTO_MIGRATE=true`). To run manually:

```
npm run migrate
```

## Project Structure

```
src/
  app.js          # Entry point
  commands/       # Slash command handlers (grouped by category)
  events/         # Discord event handlers
  services/       # Business logic (economy, tickets, etc.)
  handlers/       # Command/event loaders
  interactions/   # Button/select/modal handlers
  config/         # Configuration (bot, postgres, shop, etc.)
  utils/          # Shared utilities
scripts/          # DB migration, backup, restore scripts
database/         # SQL migration files
```

## User Preferences

- Keep existing project structure and stack
