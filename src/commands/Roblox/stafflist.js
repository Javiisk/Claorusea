import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = '376034335';
const STAFF_MIN_RANK = 7;
const STAFF_EXTRA_RANKS = new Set([243, 254, 255]);

async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
  const data = await res.json();
  return data.roles ?? [];
}

async function getMembersForRole(roleId) {
  const members = [];
  let cursor = '';

  do {
    const url = `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles/${roleId}/users?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': process.env.ROBLOX_API_KEY,
      },
    });
    if (!res.ok) break;
    const data = await res.json();
    members.push(...(data.data ?? []));
    cursor = data.nextPageCursor ?? '';
  } while (cursor);

  return members;
}

export default {
  data: new SlashCommandBuilder()
    .setName('stafflist')
    .setDescription('Displays all current staff members by rank.')
    .setDMPermission(false),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Stafflist interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'stafflist',
      });
      return;
    }

    try {
      const allRoles = await getGroupRoles();

      const staffRoles = allRoles
        .filter(r => r.rank >= STAFF_MIN_RANK || STAFF_EXTRA_RANKS.has(r.rank))
        .sort((a, b) => b.rank - a.rank);

      if (staffRoles.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ No staff roles found.',
        });
      }

      const embed = createEmbed({ title: '👥 Staff List', description: null })
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({ text: `Group ID: ${GROUP_ID}` });

      let totalStaff = 0;

      for (const role of staffRoles) {
        const members = await getMembersForRole(role.id);
        if (members.length === 0) continue;

        totalStaff += members.length;
        const names = members.map(m => `\`${m.username}\``).join(', ');
        const value = names.length > 1024 ? names.substring(0, 1020) + '...' : names;

        embed.addFields({
          name: `${role.name} (${members.length})`,
          value,
          inline: false,
        });

        if (embed.data.fields.length >= 25) break;
      }

      embed.setDescription(`**Total Staff Members: ${totalStaff}**`);

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Stafflist command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching the staff list.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
