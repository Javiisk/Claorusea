import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1504301537109868585';

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

async function setRank(userId, roleId) {
  const res = await fetch(`https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?filter=user==${userId}`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });
  const data = await res.json();
  const membership = data.groupMemberships?.[0];
  if (!membership) return { success: false, error: 'User is not in the group.' };

  const membershipId = membership.path.split('/').pop();

  const updateRes = await fetch(`https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`, {
    method: 'PATCH',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${roleId}` }),
  });

  if (updateRes.ok) return { success: true };
  const err = await updateRes.json();
  return { success: false, error: err.message || 'Failed to update rank.' };
}

export default {
  data: new SlashCommandBuilder()
    .setName('setrank')
    .setDescription('Change a user\'s rank in the group 🏅')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox username').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('rank').setDescription('Rank name or Rank ID').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('SetRank interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'setrank',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const rankInput = interaction.options.getString('rank');

      const roblox = await getRobloxUser(username);
      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Roblox user not found.',
        });
      }

      const roles = await getGroupRoles();

      // Busca por nombre o por ID
      const role = roles.find(r =>
        r.name.toLowerCase() === rankInput.toLowerCase() ||
        String(r.rank) === rankInput ||
        String(r.id) === rankInput
      );

      if (!role) {
        const roleList = roles.map(r => `\`${r.rank}\` - ${r.name}`).join('\n');
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank not found. Available ranks:\n${roleList}`,
        });
      }

      const result = await setRank(roblox.id, role.id);
      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank: ${result.error}`,
        });
      }

      // Respuesta al que usó el comando
      const embed = createEmbed({ title: '🏅 Rank Updated', description: null })
        .setDescription(`**${roblox.name}**'s rank has been changed to **${role.name}**.`)
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      // Log en el canal
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📋 Rank Change Log')
          .setColor(0x5865F2)
          .addFields(
            { name: 'Moderator', value: `${interaction.user.username} (<@${interaction.user.id}>)`, inline: false },
            { name: 'User', value: roblox.name, inline: false },
            { name: 'New Rank', value: role.name, inline: false },
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }

    } catch (error) {
      logger.error('SetRank command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while setting the rank.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
