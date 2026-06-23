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

function getUser(username) {
  const db = loadDB();
  const key = username.toLowerCase();
  if (!db[key]) db[key] = { username, trained: false, warnings: 0, blacklisted: false };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return db[key];
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

async function getRobloxGroupRank(userId) {
  try {
    const groupId = process.env.ROBLOX_GROUP_ID;
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(groupId));
    return group ? group.role.name : 'Not in the group';
  } catch {
    return 'Error fetching rank';
  }
}

async function getRobloxAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('View you roblox profile info (Use it on DMs)')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Your roblox username').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('MyInfo interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'myinfo',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const roblox = await getRobloxUser(username);

      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ User not founded.',
        });
      }

      const [rank, avatar] = await Promise.all([
        getRobloxGroupRank(roblox.id),
        getRobloxAvatar(roblox.id),
      ]);

      const userData = getUser(roblox.name);
      const trainedText = userData.trained ? '✅ Trained' : '❌ Untrained';
      const warningsText = userData.warnings > 0 ? `⚠️ ${userData.warnings}` : 'None';

      const embed = createEmbed({ title: '📋 My Info', description: null })
        .setThumbnail(avatar)
        .addFields(
          { name: 'Username', value: roblox.name, inline: false },
          { name: 'Roblox ID', value: String(roblox.id), inline: false },
          { name: 'Rank', value: rank, inline: false },
          { name: 'Trained', value: trainedText, inline: false },
          { name: 'Warnings', value: warningsText, inline: false },
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('MyInfo command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ Error fetching rank',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
