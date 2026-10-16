import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { handleDM } from './utils/dmLogger.js';
import { buildWelcomeMessage } from './utils/welcomeMessage.js';
import { applyPresence } from './utils/presence.js';
import { handleTicketButton, handleTicketModal, handleTicketSelect } from './utils/ticketHandlers.js';
import { handleApplyButton, handleApplyModal } from './utils/applyHandlers.js';
import { handleFeedbackButton } from './utils/feedbackHandlers.js';
import { handleMusicButton } from './utils/musicButtons.js';
import { handleMessageXp } from './utils/leveling.js';
import { handleForumThreadCreate, handleResolveThread } from './utils/bugForum.js';
import { handleStarButton, handleFeedbackModal } from './utils/bugFeedback.js';
import { attachEventLogging } from './utils/eventLogger.js';

// ✅ Staff system
import { ensureStaffTable } from './utils/staffStorage.js';
import { startStaffSync } from './utils/staffSync.js';

// ✅ NEW: Autoban + Daily Summary
import { registerAutoban } from './events/autobanMessage.js';
import { startDailyBanSummary } from './utils/dailyBanSummary.js';

// ✅ NEW: Web API routes
import { registerAuthRoutes } from './web/auth.js';
import { registerGetChannelsRoute } from './web/getChannels.js';
import { registerSendContainerRoute } from './web/sendContainer.js';

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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Channel, Partials.Message],
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

    if (!fs.statSync(commandsPath).isDirectory()) continue;

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

  app.use(cors({
    origin: 'https://javiisk.github.io',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }));

  app.use(express.json());

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

  // ✅ Web API routes
  registerAuthRoutes(app);
  registerGetChannelsRoute(app, client);
  registerSendContainerRoute(app, client);

  app.listen(port, () => {
    console.log(`✅ Web server running on port ${port}`);
  });
}

// ─── EVENTS ──────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot connected as ${client.user.tag}`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);

  applyPresence(
    client,
    process.env.STATUS_TEXT || 'Patients and messages',
    process.env.STATUS_TYPE || 'watching',
  );

  attachEventLogging(client);

  // ✅ Staff system
  await ensureStaffTable();
  startStaffSync(client);

  // ✅ NEW: Autoban + Daily summary
  registerAutoban(client);
  startDailyBanSummary(client);

  startWebServer();

  const commands = await loadCommands();
  await registerCommands(commands);

  console.log(`🎯 ${client.commands.size} commands ready to use.`);
});

// ─── INTERACTION CREATE ──────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && typeof command.autocomplete === 'function') {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`❌ Error in autocomplete for ${interaction.commandName}:`, error);
      }
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    try {
      await handleMusicButton(interaction);
    } catch (error) {
      console.error('❌ Error handling music button:', error);
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_open_select_')) {
    try {
      await handleTicketSelect(interaction);
    } catch (error) {
      console.error('❌ Error handling ticket select menu:', error);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
    try {
      await handleTicketButton(interaction);
    } catch (error) {
      console.error('❌ Error handling ticket button:', error);
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_')) {
    try {
      await handleTicketModal(interaction);
    } catch (error) {
      console.error('❌ Error handling ticket modal:', error);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('apply_')) {
    try {
      await handleApplyButton(interaction);
    } catch (error) {
      console.error('❌ Error handling apply button:', error);
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('apply_')) {
    try {
      await handleApplyModal(interaction);
    } catch (error) {
      console.error('❌ Error handling apply modal:', error);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === 'feedback_view') {
    try {
      await handleFeedbackButton(interaction);
    } catch (error) {
      console.error('❌ Error handling feedback button:', error);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('bugfeedback_star_')) {
    try {
      await handleStarButton(interaction);
    } catch (error) {
      console.error('❌ Error handling bug feedback star button:', error);
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('bugfeedback_modal_')) {
    try {
      await handleFeedbackModal(interaction);
    } catch (error) {
      console.error('❌ Error handling bug feedback modal:', error);
    }
    return;
  }

  if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Mark Resolved') {
    try {
      await handleResolveThread(interaction);
    } catch (error) {
      console.error('❌ Error handling Mark Resolved context menu:', error);
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
  console.log(`🔔 messageCreate fired — channel type: ${message.channel.type}, author: ${message.author.tag}, bot: ${message.author.bot}`);
  await handleDM(client, message);
  await handleMessageXp(message);
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

// ─── BUG FORUM: NEW POST HANDLER ───────────────────────────────────────────

client.on('threadCreate', async (thread, newlyCreated) => {
  if (!newlyCreated) return;
  await handleForumThreadCreate(thread);
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