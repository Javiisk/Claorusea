import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

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
  ],
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
    res.send('Bot is alive!');
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.log(`✅ Web server running on port ${port}`);
  });
}

// ─── EVENTS ──────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot connected as ${client.user.tag}`);

  startWebServer();

  const commands = await loadCommands();
  await registerCommands(commands);

  console.log(`🎯 ${client.commands.size} commands ready to use.`);
});

client.on('interactionCreate', async (interaction) => {
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
    await interaction.reply({
      content: '❌ An error occurred while executing the command.',
      ephemeral: true,
    });
  }
});

// ─── GLOBAL ERROR HANDLERS ──────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ─── LOGIN ────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);