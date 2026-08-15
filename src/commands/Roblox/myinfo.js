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
} from '../../utils/bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');
const GROUPS_PATH = join(__dirname, '../../../../blacklisted-groups.json');

const DEFAULT_GROUPS = [
  { id: '9221386', name: 'Unholy sacred sisters' },
  { id: '1097260506', name: 'Démoria' },
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

function saveDB(data) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    logger.error('Error saving DB:', e);
    return false;
  }
}

function getUserData(discordId) {
  const db = loadDB();
  const key = discordId;
  if (!db[key]) {
    db[key] = { 
      discordId: discordId, 
      robloxId: null, 
      username: null, 
      trained: false, 
      warnings: [], 
      blacklisted: false, 
      blacklistReason: null 
    };
    saveDB(db);
  }
  return db[key];
}

function saveUserData(discordId, data) {
  const db = loadDB();
  const key = discordId;
  db[key] = { ...(db[key] || { discordId: discordId, robloxId: null, username: null, trained: false, warnings: [] }), ...data };
  return saveDB(db);
}

export default {
  data: new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('View your Roblox profile and group status')
    .setDMPermission(true),

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
      const targetUser = interaction.user;

      logger.info(`[MyInfo] Looking up: ${targetUser.tag} (${targetUser.id})`);

      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);

      if (!bloxlinkData || !bloxlinkData.robloxID) {
        logger.warn(`[MyInfo] ${targetUser.tag} not linked`);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const newRobloxId = String(bloxlinkData.robloxID);
      let robloxUsername = bloxlinkData.primaryAccount || null;

      if (!robloxUsername || robloxUsername === 'Unknown' || robloxUsername === 'null') {
        const username = await getRobloxUsernameById(newRobloxId);
        if (username) robloxUsername = username;
      }
      if (!robloxUsername) robloxUsername = `User_${newRobloxId}`;

      logger.info(`[MyInfo] Roblox: ${robloxUsername} (${newRobloxId})`);

      let userData = getUserData(targetUser.id);

      if (userData.robloxId && userData.robloxId !== newRobloxId) {
        logger.info(`[MyInfo] ACCOUNT CHANGE DETECTED for ${targetUser.tag}. Old: ${userData.robloxId}, New: ${newRobloxId}`);

        saveUserData(targetUser.id, {
          robloxId: newRobloxId,
          username: robloxUsername,
          trained: false,
          warnings: [],   
          blacklisted: false,
          blacklistReason: null
        });

        userData = getUserData(targetUser.id);
      } 
      else if (!userData.robloxId) {
        saveUserData(targetUser.id, {
          robloxId: newRobloxId,
          username: robloxUsername
        });
        userData.robloxId = newRobloxId;
        userData.username = robloxUsername;
      }
      else if (userData.username !== robloxUsername) {
        saveUserData(targetUser.id, { username: robloxUsername });
        userData.username = robloxUsername;
      }

      const [rank, avatar, blacklistedGroup] = await Promise.all([
        getRobloxGroupRank(newRobloxId),
        getRobloxAvatar(newRobloxId),
        checkBlacklistedGroups(newRobloxId, loadGroups()),
      ]);

      if (blacklistedGroup && !userData.blacklisted) {
        saveUserData(targetUser.id, {
          blacklisted: true,
          blacklistReason: `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`,
        });
        userData.blacklisted = true;
        userData.blacklistReason = `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`;
      }

      // ✅ TRAINED STATUS WITH CUSTOM EMOJIS
      const trainedText = userData.trained 
        ? `<:VerifiedIcon:1502787139845230622> Trained` 
        : `<:UnverifiedIcon:1502787138700443668> Untrained`;

      let warningsText = 'None';
      if (userData.warnings && userData.warnings.length > 0) {
        const lastWarns = userData.warnings.slice(-5).reverse();
        warningsText = lastWarns.map(w => 
          `⚠️ **#${w.id}** - ${w.reason} *(by ${w.moderator})*`
        ).join('\n');
        if (userData.warnings.length > 5) {
          warningsText += `\n...and ${userData.warnings.length - 5} more warnings.`;
        }
      }

      const blacklistText = userData.blacklisted
        ? `🚫 ${userData.blacklistReason || 'No reason'}`
        : 'None';

      // ✅ EMBED WITH CUSTOM EMOJI IN TITLE
      const embed = createEmbed({ 
        title: `<:SurveyIcon:1502787137278312499> ${robloxUsername}'s Profile`,
        description: null 
      })
        .setThumbnail(avatar)
        .addFields(
          { name: 'Discord User', value: `${targetUser}`, inline: false },
          { name: 'Roblox ID', value: String(newRobloxId), inline: false },
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