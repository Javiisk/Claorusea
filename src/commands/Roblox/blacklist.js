import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1513424765912875108',
  '1505673747892535306',
  '1505673808097574912',
  '1505673879069393024',
];

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0, blacklisted: false }), ...data };
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

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      if (!reason) {
        saveUser(robloxUsername, { blacklisted: false, blacklistReason: null });
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

      saveUser(robloxUsername, { blacklisted: true, blacklistReason: reason });
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
