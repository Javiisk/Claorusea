import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1504301537109868585';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673879069393024',
  '1505673808097574912',
];

async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return data.roles || [];
}

async function setRank(userId, roleId) {
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
    return { success: false, error: err.message || 'Failed to update rank.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('setrank')
    .setDescription('Change a user\'s rank in the group 🏅')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('rank')
        .setDescription('Rank name or Rank ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('SetRank interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'setrank' });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');
      const rankInput = interaction.options.getString('rank');

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const roles = await getGroupRoles();
      const role = roles.find(r =>
        r.name.toLowerCase() === rankInput.toLowerCase() ||
        String(r.rank) === rankInput ||
        String(r.id) === rankInput
      );

      if (!role) {
        const roleList = roles.map(r => `\`${r.rank}\` - ${r.name}`).join('\n');
        return await InteractionHelper.safeEditReply(interaction, { 
          content: `❌ Rank not found. Available ranks:\n${roleList}` 
        });
      }

      const result = await setRank(robloxId, role.id);
      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, { 
          content: `❌ Failed to set rank: ${result.error}` 
        });
      }

      const embed = createEmbed({ title: '🏅 Rank Updated', description: null })
        .setDescription(`**${robloxUsername}**'s rank has been changed to **${role.name}**.`)
        .addFields(
          { name: 'Roblox ID', value: String(robloxId), inline: true },
          { name: 'Discord User', value: `${targetUser}`, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📋 Rank Change Log')
          .setColor(0x5865F2)
          .addFields(
            { name: 'Moderator', value: `${interaction.user.username} (<@${interaction.user.id}>)`, inline: false },
            { name: 'User', value: robloxUsername, inline: false },
            { name: 'Roblox ID', value: String(robloxId), inline: false },
            { name: 'New Rank', value: role.name, inline: false },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

    } catch (error) {
      logger.error('SetRank command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};
