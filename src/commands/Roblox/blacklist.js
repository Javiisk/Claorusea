import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js'; // ✅ Ruta actualizada

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

const ALLOWED_ROLES = [
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671296883757158',
  '1505671292873867544',
];

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

// 🔥 IMPORTANTE: Guardamos usando el DISCORD ID como clave
function saveUserData(discordId, data) {
  const db = loadDB();
  const key = discordId;
  db[key] = { ...(db[key] || { discordId: discordId, robloxId: null, username: null, trained: false, warnings: [], blacklisted: false, blacklistReason: null }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist or unblacklist a user 🚫')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason (leave empty to remove blacklist)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Blacklist interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'blacklist' });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      // ✅ Obtener Roblox info desde Bloxlink (desde utils/)
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = String(userInfo.id || userInfo.robloxID);

      // 🔥 Guardamos usando el Discord ID, y actualizamos el Roblox ID y nombre
      if (!reason) {
        // QUITAR BLACKLIST
        saveUserData(targetUser.id, { 
          blacklisted: false, 
          blacklistReason: null,
          robloxId: robloxId,
          username: robloxUsername
        });

        const embed = createEmbed({ title: '✅ Blacklist Removed', description: null })
          .setDescription(`**${robloxUsername}** has been removed from the blacklist.`)
          .addFields(
            { name: 'Roblox ID', value: String(robloxId), inline: true },
            { name: 'Discord User', value: `${targetUser}`, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // PONER BLACKLIST
      saveUserData(targetUser.id, { 
        blacklisted: true, 
        blacklistReason: reason,
        robloxId: robloxId,
        username: robloxUsername
      });

      const embed = createEmbed({ title: '🚫 User Blacklisted', description: null })
        .setDescription(`**${robloxUsername}** has been blacklisted.\n**Reason:** ${reason}`)
        .addFields(
          { name: 'Roblox ID', value: String(robloxId), inline: true },
          { name: 'Discord User', value: `${targetUser}`, inline: true }
        )
        .setColor(0xED4245)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('Blacklist command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};