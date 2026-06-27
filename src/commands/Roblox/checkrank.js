import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;

async function getCurrentRank(userId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(GROUP_ID));
    return group ? group.role : null;
  } catch {
    return null;
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
    .setName('checkrank')
    .setDescription('Check a user\'s current rank in the group 🏅')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to check')
        .setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('CheckRank defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const [currentRole, avatar] = await Promise.all([
        getCurrentRank(robloxId),
        getRobloxAvatar(robloxId),
      ]);

      const embed = new EmbedBuilder()
        .setTitle('🏅 Rank Check')
        .setColor(0x5865F2)
        .setThumbnail(avatar)
        .addFields(
          { name: 'Username', value: robloxUsername, inline: false },
          { name: 'Roblox ID', value: String(robloxId), inline: false },
          { name: 'Discord User', value: `${targetUser}`, inline: false },
          { name: 'Current Rank', value: currentRole ? currentRole.name : 'Not in the group', inline: false },
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('CheckRank error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
