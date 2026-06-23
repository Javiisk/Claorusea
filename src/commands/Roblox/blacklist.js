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
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0 }), ...data };
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
    .setName('blacklist')
    .setDescription('Agregar o quitar a un usuario de la blacklist 🚫')
    .addStringOption(opt =>
      opt.setName('usuario').setDescription('Usuario de Roblox').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motivo').setDescription('Motivo de la blacklist (deja vacío para quitar la blacklist)').setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Blacklist interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'blacklist',
      });
      return;
    }

    try {
      const username = interaction.options.getString('usuario');
      const motivo = interaction.options.getString('motivo');
      const roblox = await getRobloxUser(username);

      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Usuario de Roblox no encontrado.',
        });
      }

      // Si no hay motivo, se quita la blacklist
      if (!motivo) {
        saveUser(roblox.name, { blacklisted: false, blacklistReason: null });

        const embed = createEmbed({ title: '✅ Blacklist Eliminada', description: null })
          .setDescription(`**${roblox.name}** ha sido removido de la blacklist.`)
          .setColor(0x57F287)
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // Si hay motivo, se agrega a la blacklist
      saveUser(roblox.name, { blacklisted: true, blacklistReason: motivo });

      const embed = createEmbed({ title: '🚫 Usuario Blacklisteado', description: null })
        .setDescription(`**${roblox.name}** ha sido agregado a la blacklist.\n**Motivo:** ${motivo}`)
        .setColor(0xED4245)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Blacklist command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ Hubo un error al actualizar la blacklist.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
