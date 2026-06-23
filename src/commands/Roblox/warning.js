import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, trained: false, blacklisted: false }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Agregar advertencias a un usuario')
    .addStringOption(opt =>
      opt.setName('usuario').setDescription('Usuario de Roblox').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('warnings').setDescription('Número de warnings').setRequired(true).setMinValue(0).setMaxValue(10)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Warning interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'warning',
      });
      return;
    }

    try {
      const username = interaction.options.getString('usuario');
      const warnings = interaction.options.getInteger('warnings');
      const roblox = await getRobloxUser(username);

      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Usuario de Roblox no encontrado.',
        });
      }

      saveUser(roblox.name, { warnings });

      const embed = createEmbed({ title: '⚠️ Warnings Actualizados', description: null })
        .setDescription(`**${roblox.name}** ahora tiene **${warnings} warning(s)**.`)
        .setColor(0xFEE75C)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Warning command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ Hubo un error al actualizar los warnings.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
