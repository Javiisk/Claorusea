import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
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
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.user;

      logger.info(`[MyInfo] Looking up: ${targetUser.tag} (${targetUser.id})`);

      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);

      if (!bloxlinkData || !bloxlinkData.robloxID) {
        return await interaction.editReply({
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

      let userData = getUserData(targetUser.id);

      if (userData.robloxId && userData.robloxId !== newRobloxId) {
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

      // Emojis removed on purpose — add your own custom server emojis here
      // wherever you'd like (e.g. before "Trained" / "Untrained").
      const trainedText = userData.trained ? 'Trained' : 'Untrained';

      let warningsText = 'None';
      if (userData.warnings && userData.warnings.length > 0) {
        const lastWarns = userData.warnings.slice(-5).reverse();
        warningsText = lastWarns.map(w =>
          `**#${w.id}** - ${w.reason} *(by ${w.moderator})*`
        ).join('\n');
        if (userData.warnings.length > 5) {
          warningsText += `\n...and ${userData.warnings.length - 5} more warnings.`;
        }
      }

      const blacklistText = userData.blacklisted
        ? `${userData.blacklistReason || 'No reason'}`
        : 'None';

      // ─── CONTAINER V2: título + info (sin thumbnail, sin footer, sin color) ──

      const infoText = [
        `**Discord User**\n<@${targetUser.id}>`,
        `**Roblox ID**\n${newRobloxId}`,
        `**Rank**\n${rank}`,
        `**Trained Status**\n${trainedText}`,
        `**Warnings**\n${warningsText}`,
        `**Blacklists**\n${blacklistText}`,
      ].join('\n\n');

      const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${robloxUsername}'s Profile`),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(infoText),
        );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      logger.error('MyInfo command error:', error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred while fetching the information.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
