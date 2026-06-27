import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
  getRobloxUserByDiscord, 
  getRobloxUsernameById,
  getRobloxGroupRank,
  getRobloxAvatar,
  checkBlacklistedGroups
} from './bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');
const GROUPS_PATH = join(__dirname, '../../../../blacklisted-groups.json');

const DEFAULT_GROUPS = [
  { id: '9221386', name: 'Unholy sacred sisters' },
  { id: '14029943', name: 'Empyreúm' },
  { id: '1097260506', name: 'Démoria' },
  { id: '97539052', name: 'Ivaloria' },
  { id: '35008390', name: 'la vélvoria' },
];

function loadGroups() {
  if (!existsSync(GROUPS_PATH)) {
    writeFileSync(GROUPS_PATH, JSON.stringify(DEFAULT_GROUPS, null, 2));
    return DEFAULT_GROUPS;
  }
  return JSON.parse(readFileSync(GROUPS_PATH, 'utf8'));
}

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function getUser(username) {
  const db = loadDB();
  const key = username.toLowerCase();
  if (!db[key]) db[key] = { username, trained: false, warnings: 0, blacklisted: false, blacklistReason: null };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return db[key];
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0 }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('View your Roblox profile and group status')
    .setDMPermission(true)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to look up (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('MyInfo interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId || 'DM',
        commandName: 'myinfo',
      });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      logger.info(`[MyInfo] Looking up: ${targetUser.tag} (${targetUser.id})`);

      // ✅ Usar bloxlink.js
      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);

      if (!bloxlinkData || !bloxlinkData.robloxID) {
        logger.warn(`[MyInfo] ${targetUser.tag} not linked`);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = bloxlinkData.robloxID;
      
      // ✅ Obtener nombre usando bloxlink.js
      let robloxUsername = bloxlinkData.primaryAccount || null;
      if (!robloxUsername || robloxUsername === 'Unknown' || robloxUsername === 'null') {
        const username = await getRobloxUsernameById(robloxId);
        if (username) robloxUsername = username;
      }

      if (!robloxUsername) {
        robloxUsername = `User_${robloxId}`;
      }

      logger.info(`[MyInfo] Roblox: ${robloxUsername} (${robloxId})`);

      // ✅ Usar bloxlink.js
      const [rank, avatar, blacklistedGroup] = await Promise.all([
        getRobloxGroupRank(robloxId),
        getRobloxAvatar(robloxId),
        checkBlacklistedGroups(robloxId, loadGroups()),
      ]);

      const userData = getUser(robloxUsername);

      if (blacklistedGroup && !userData.blacklisted) {
        saveUser(robloxUsername, {
          blacklisted: true,
          blacklistReason: `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`,
        });
        userData.blacklisted = true;
        userData.blacklistReason = `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`;
      }

      const trainedText = userData.trained ? '✅ Trained' : '❌ Untrained';
      const warningsText = userData.warnings > 0 ? `⚠️ ${userData.warnings}` : 'None';
      const blacklistText = userData.blacklisted
        ? `🚫 ${userData.blacklistReason || 'No reason'}`
        : 'None';

      const embed = createEmbed({ title: `📋 ${robloxUsername}'s Profile`, description: null })
        .setThumbnail(avatar)
        .addFields(
          { name: 'Discord User', value: `${targetUser}`, inline: false },
          { name: 'Roblox ID', value: String(robloxId), inline: false },
          { name: 'Rank', value: rank, inline: false },
          { name: 'Trained Status', value: trainedText, inline: false },
          { name: 'Warnings', value: warningsText, inline: false },
          { name: 'Blacklists', value: blacklistText, inline: false },
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('MyInfo command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching the information.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
