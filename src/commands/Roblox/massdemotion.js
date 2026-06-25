import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = '376034335';
const TARGET_RANK = 2;
const LOG_CHANNEL_ID = '1504301603262566440';

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
  return data.data?.[0] ?? null;
}

async function getUserRank(userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!res.ok) return null;
  const data = await res.json();
  const group = data.data?.find(g => g.group.id === 376034335);
  return group ? { rank: group.role.rank, role: group.role.name } : null;
}

async function getRankIdByRank(rank) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  if (!res.ok) throw new Error('Failed to fetch group roles');
  const data = await res.json();
  const role = data.roles?.find(r => r.rank === rank);
  return role?.id ?? null;
}

async function setRank(userId, rankId) {
  const res = await fetch(
    `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?filter=user=='users/${userId}'`,
    { headers: { 'x-api-key': process.env.ROBLOX_API_KEY } }
  );
  if (!res.ok) throw new Error(`Failed to fetch membership: ${res.status}`);
  const data = await res.json();
  const membership = data.groupMemberships?.[0];
  if (!membership) throw new Error('User is not in the group');

  const updateRes = await fetch(
    `https://apis.roblox.com/cloud/v2/${membership.path}`,
    {
      method: 'PATCH',
      headers: {
        'x-api-key': process.env.ROBLOX_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${rankId}` }),
    }
  );
  if (!updateRes.ok) throw new Error(`Failed to set rank: ${updateRes.status}`);
  return await updateRes.json();
}

export default {
  data: new SlashCommandBuilder()
    .setName('massdemotion')
    .setDescription('Demotes a user to the lowest rank. (Staff only)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox username').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the demotion').setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Massdemotion interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'massdemotion',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided.';

      const roblox = await getRobloxUser(username);
      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Roblox user not found.',
        });
      }

      const currentRank = await getUserRank(roblox.id);
      if (!currentRank) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${roblox.name}** is not in the group.`,
        });
      }

      const rankId = await getRankIdByRank(TARGET_RANK);
      if (!rankId) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not find the target rank.',
        });
      }

      await setRank(roblox.id, rankId);

      // Success embed
      const embed = createEmbed({ title: '⬇️ Mass Demotion Applied', description: null })
        .setColor(0xed4245)
        .addFields(
          { name: '👤 User', value: `\`${roblox.name}\``, inline: true },
          { name: '📉 Previous Rank', value: `${currentRank.role} (${currentRank.rank})`, inline: true },
          { name: '📌 New Rank', value: `Rank ${TARGET_RANK}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '👮 Actioned by', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      // Log
      try {
        const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = createEmbed({ title: '📋 Mass Demotion Log', description: null })
            .setColor(0xed4245)
            .addFields(
              { name: '👤 User', value: `\`${roblox.name}\` (${roblox.id})`, inline: true },
              { name: '📉 Previous Rank', value: `${currentRank.role} (${currentRank.rank})`, inline: true },
              { name: '📌 New Rank', value: `Rank ${TARGET_RANK}`, inline: true },
              { name: '📝 Reason', value: reason, inline: false },
              { name: '👮 Actioned by', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (e) {
        logger.warn('Could not post to log channel:', e.message);
      }
    } catch (error) {
      logger.error('Massdemotion command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while applying the demotion.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
