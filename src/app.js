import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLIENTE ──────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

// ─── CARGAR COMANDOS ──────────────────────────────────────────────────────

async function loadCommands() {
  const commands = [];
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import(`file://${filePath}`);
      const cmd = command.default || command;

      if (cmd && 'data' in cmd && 'execute' in cmd) {
        client.commands.set(cmd.data.name, cmd);
        commands.push(cmd.data.toJSON());
        console.log(`✅ Comando cargado: ${cmd.data.name}`);
      } else {
        console.log(`⚠️ ${file} no tiene "data" o "execute"`);
      }
    }
  }

  return commands;
}

// ─── REGISTRAR COMANDOS ──────────────────────────────────────────────────

async function registerCommands(commands) {
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    console.log(`🔄 Registrando ${commands.length} comandos...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ ${commands.length} comandos registrados correctamente!`);
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = await loadCommands();
  await registerCommands(commands);

  console.log(`🎯 ${client.commands.size} comandos listos para usar.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({
      content: '❌ Comando no encontrado.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error al ejecutar ${interaction.commandName}:`, error);
    await interaction.reply({
      content: '❌ Ocurrió un error al ejecutar el comando.',
      ephemeral: true,
    });
  }
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);