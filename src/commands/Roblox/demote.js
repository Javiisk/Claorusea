import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1504301603262566440';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

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
    .setName('demote')
    .setDescription('Demote a user one rank down ⬇️')
    .addStringOption(opt =>
      opt.setName('robloxuser').setDescription('Roblox username').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for demotion').setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Demote defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const username = interaction.options.getString('robloxuser');
      const reason = interaction.options.getString('reason');

      const roblox = await getRobloxUser(username);
      if (!roblox) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Roblox user not found.' });

      const currentRole = await getCurrentRank(roblox.id);
      if (!currentRole) return await InteractionHelper.safeEditReply(interaction, { content: '❌ User is not in the group.' });

      const roles = await getGroupRoles();
      const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
      const currentIndex = sortedRoles.findIndex(r => r.id === currentRole.id);

      if (currentIndex <= 0) {
        return await InteractionHelper.safeEditReply(interaction, { content: '❌ User is already at the lowest rank.' });
      }

      const newRole = sortedRoles[currentIndex - 1];
      const result = await setRankByRoleId(roblox.id, newRole.id);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, { content: `❌ Failed to demote: ${result.error}` });
      }

      const embed = new EmbedBuilder()
        .setTitle('⬇️ User Demoted')
        .setColor(0xED4245)
        .addFields(
          { name: 'User', value: roblox.name, inline: false },
          { name: 'Previous Rank', value: currentRole.name, inline: true },
          { name: 'New Rank', value: newRole.name, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Demoted by', value: `${interaction.user.username} (<@${interaction.user.id}>)`, inline: false },
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Demote error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
        }
