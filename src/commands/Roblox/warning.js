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
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
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
    .setName('warning')
    .setDescription('Add warnings to a user')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('warnings')
        .setDescription('Number of warnings (0-10)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(10)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Warning interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'warning' });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');
      const warnings = interaction.options.getInteger('warnings');

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      saveUser(robloxUsername, { warnings });

      const embed = createEmbed({ title: '⚠️ Warnings Updated', description: null })
        .setDescription(`**${robloxUsername}** (${targetUser.tag}) now has **${warnings}** warning(s).`)
        .addFields(
          { name: 'Roblox ID', value: String(robloxId), inline: true },
          { name: 'Discord User', value: `${targetUser}`, inline: true }
        )
        .setColor(0xFEE75C)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Warning command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};
