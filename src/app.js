import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { handleDM } from './utils/dmLogger.js'; // ✅ Import DM logger (matches actual file name/casing)
import { buildWelcomeMessage } from './utils/welcomeMessage.js'; // ✅ Import welcome message builder
import { applyPresence } from './utils/presence.js'; // ✅ Import presence/status helper
import { handleAutoroleSelect } from './utils/autoroles.js'; // ✅ Import autoroles select-menu handler
import { handleReactionAdd, handleReactionRemove } from './utils/reactroles.js'; // ✅ Import reaction role handlers

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages, // ✅ Added to read DMs
    GatewayIntentBits.DirectMessageReactions, // ✅ Added for DM reactions (optional)
  ],
  // ✅ Fixed: discord.js v14 uses the Partials enum, not raw strings like
  // 'CHANNEL' (that was v13 syntax). Without this fix, DM channels that
  // aren't cached yet may fail to fire messageCreate events.
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();

// ─── LOAD COMMANDS ──────────────────────────────────────────────────────

async function loadCommands() {
  const commands = [];
  const foldersPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(foldersPath)) {
    console.log('⚠️ No commands folder found.');
    return commands;
  }

  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);

    if (!fs.statSync(commandsPath).isDirectory()) continue; // ✅ Skip stray files

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const command = await import(`file://${filePath}`);
        const cmd = command.default || command;

        if (cmd && 'data' in cmd && 'execute' in cmd) {
          client.commands.set(cmd.data.name, cmd);
          commands.push(cmd.data.toJSON());
          console.log(`✅ Loaded command: ${cmd.data.name}`);
        } else {
          console.log(`⚠️ ${file} missing "data" or "execute"`);
        }
      } catch (error) {
        console.error(`❌ Error loading ${file}:`, error.message);
      }
    }
  }

  return commands;
}

// ─── REGISTER COMMANDS ──────────────────────────────────────────────────

async function registerCommands(commands) {
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    console.log(`🔄 Registering ${commands.length} commands...`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ ${commands.length} commands registered successfully!`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// ─── WEB SERVER FOR RENDER ──────────────────────────────────────────────

function startWebServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    res.send('Bot is alive! 🤖');
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      commands: client.commands.size,
      guilds: client.guilds.cache.size
    });
  });

  app.listen(port, () => {
    console.log(`✅ Web server running on port ${port}`);
  });
}

// ─── EVENTS ──────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot connected as ${client.user.tag}`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);

  // Default status shown under the bot's name — change anytime with /status,
  // or by editing STATUS_TEXT / STATUS_TYPE in your environment variables.
  applyPresence(
    client,
    process.env.STATUS_TEXT || 'Patients and messages',
    process.env.STATUS_TYPE || 'watching',
  );

  startWebServer();

  const commands = await loadCommands();
  await registerCommands(commands);

  console.log(`🎯 ${client.commands.size} commands ready to use.`);
});

// ─── INTERACTION CREATE ──────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  // ✅ Added: handle autorole select menu picks (not a slash command).
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('autorole_select_')) {
    try {
      await handleAutoroleSelect(interaction);
    } catch (error) {
      console.error('❌ Error handling autorole select menu:', error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({
      content: '❌ Command not found.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);

    // ✅ Fixed: use followUp if the interaction was already replied/deferred,
    // otherwise reply() throws "already replied" and swallows the real error.
    const errorReply = {
      content: '❌ An error occurred while executing the command.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply);
    } else {
      await interaction.reply(errorReply);
    }
  }
});

// ─── DM MESSAGE HANDLER ──────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  // 🔍 Temporary debug log — remove once DMs are confirmed working.
  console.log(`🔔 messageCreate fired — channel type: ${message.channel.type}, author: ${message.author.tag}, bot: ${message.author.bot}`);
  await handleDM(client, message);
});

// ─── WELCOME MESSAGE HANDLER ──────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  console.log(`👋 guildMemberAdd fired — ${member.user.tag} joined ${member.guild.name}`);

  const channelId = process.env.WELCOME_CHANNEL_ID;

  if (!channelId) {
    console.warn('⚠️ WELCOME_CHANNEL_ID is not set — skipping welcome message.');
    return;
  }

  const channel = await member.guild.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    console.error(`❌ Could not find/access the welcome channel with ID ${channelId}.`);
    return;
  }

  await channel.send(buildWelcomeMessage(member)).catch((error) => {
    console.error('❌ Failed to send the welcome message:', error);
  });
});

// ─── REACTION ROLE HANDLERS ────────────────────────────────────────────────

client.on('messageReactionAdd', async (reaction, user) => {
  await handleReactionAdd(reaction, user);
});

client.on('messageReactionRemove', async (reaction, user) => {
  await handleReactionRemove(reaction, user);
});

// ─── GLOBAL ERROR HANDLERS ──────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ─── MANEJO DE SEÑALES ──────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// ─── LOGIN ────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);
