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
    .setName('trained')
    .setDescription('Mark a user as trained ✅')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to mark as trained')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Trained interaction defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;

      saveUser(robloxUsername, { trained: true });

      const embed = createEmbed({ title: '✅ User Trained', description: null })
        .setDescription(`**${robloxUsername}** (${targetUser.tag}) has been marked as **Trained**.`)
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('Trained command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
