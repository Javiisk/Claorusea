import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const LOG_CHANNEL_ID = '1504301603262566440';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
];

async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return data.roles || [];
}

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

async function setRankByRoleId(userId, roleId) {
  try {
    const res = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?filter=user=='users/${userId}'`,
      { headers: { 'x-api-key': API_KEY } }
    );
    const data = await res.json();
    let membership = data.groupMemberships?.[0];

    if (!membership) {
      const res2 = await fetch(
        `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?maxPageSize=1&filter=user==users/${userId}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      const data2 = await res2.json();
      membership = data2.groupMemberships?.[0];
      if (!membership) return { success: false, error: 'User is not in the group.' };
    }

    const membershipId = membership.path.split('/').pop();
    const updateRes = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${roleId}` }),
      }
    );

    if (updateRes.ok) return { success: true };
    const err = await updateRes.json();
    return { success: false, error: err.message || 'Failed.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a user one rank up ⬆️')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to promote')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for promotion')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Promote defer failed', { userId: interaction.user.id });
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

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const currentRole = await getCurrentRank(robloxId);
      if (!currentRole) return await InteractionHelper.safeEditReply(interaction, { content: '❌ User is not in the group.' });

      const roles = await getGroupRoles();
      const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
      const currentIndex = sortedRoles.findIndex(r => r.id === currentRole.id);

      if (currentIndex === -1 || currentIndex === sortedRoles.length - 1) {
        return await InteractionHelper.safeEditReply(interaction, { content: '❌ User is already at the highest rank.' });
      }

      const newRole = sortedRoles[currentIndex + 1];
      const result = await setRankByRoleId(robloxId, newRole.id);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, { content: `❌ Failed to promote: ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle('⬆️ User Promoted')
        .setColor(0x57F287)
        .addFields(
          { name: 'User', value: robloxUsername, inline: false },
          { name: 'Roblox ID', value: String(robloxId), inline: true },
          { name: 'Discord User', value: `${targetUser}`, inline: true },
          { name: 'Previous Rank', value: currentRole.name, inline: true },
          { name: 'New Rank', value: newRole.name, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Promoted by', value: `${interaction.user.username} (<@${interaction.user.id}>)`, inline: false },
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Promote error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
