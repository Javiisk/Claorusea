import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1504301537109868585';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    const data = await res.json();
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

async function getGroupRoles() {
  try {
    const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();
    return data.roles || [];
  } catch {
    return [];
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

async function sendLog(interaction, usernames, targetRole, successCount, failCount, results) {
  try {
    const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const successList = results.filter(r => r.success).map(r => r.username);
    const failList = results.filter(r => !r.success).map(r => `**${r.username}** - ${r.error}`);

    const embed = new EmbedBuilder()
      .setColor(successCount > 0 ? 0x57F287 : 0xED4245)
      .setTitle('📊 Mass Ranking Log')
      .setDescription(`**${interaction.user.tag}** used \`/massrank\``)
      .addFields(
        { name: '📊 Target Rank', value: `\`${targetRole.name}\``, inline: true },
        { name: '👥 Total Users', value: `\`${usernames.length}\``, inline: true },
        { name: '✅ Success', value: `\`${successCount}\``, inline: true },
        { name: '❌ Failed', value: `\`${failCount}\``, inline: true }
      )
      .setTimestamp();

    if (successList.length > 0) {
      embed.addFields({
        name: '✅ Successfully Ranked',
        value: successList.map(u => `\`${u}\``).join(', ') || 'None',
        inline: false,
      });
    }

    if (failList.length > 0) {
      embed.addFields({
        name: '❌ Failed',
        value: failList.slice(0, 10).join('\n') + (failList.length > 10 ? `\n... and ${failList.length - 10} more` : ''),
        inline: false,
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('[MassRank] Log error:', error);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('massrank')
    .setDescription('📊 Mass rank multiple users to a specific rank (Staff only)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('users')
        .setDescription('List of Roblox usernames separated by commas')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('rank')
        .setDescription('Rank name or ID to set')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: false });

    try {
      const usersInput = interaction.options.getString('users');
      const rankInput = interaction.options.getString('rank');

      const usernames = usersInput.split(',').map(u => u.trim()).filter(u => u.length > 0);

      if (usernames.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ No users provided.',
        });
      }

      if (usernames.length > 50) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '⚠️ Maximum 50 users per command.',
        });
      }

      const roles = await getGroupRoles();
      let targetRole = roles.find(r =>
        r.name.toLowerCase() === rankInput.toLowerCase() ||
        String(r.rank) === rankInput ||
        String(r.id) === rankInput
      );

      if (!targetRole) {
        const roleList = roles.map(r => `\`${r.rank}\` - ${r.name}`).join('\n');
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank not found. Available ranks:\n${roleList}`,
        });
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      await InteractionHelper.safeEditReply(interaction, {
        content: `⏳ Processing ${usernames.length} users...`,
      });

      for (const username of usernames) {
        const roblox = await getRobloxUser(username);
        if (!roblox) {
          results.push({ username, success: false, error: 'User not found' });
          failCount++;
          continue;
        }

        const result = await setRankByRoleId(roblox.id, targetRole.id);
        if (result.success) {
          results.push({ username: roblox.name, success: true });
          successCount++;
        } else {
          results.push({ username: roblox.name, success: false, error: result.error });
          failCount++;
        }
      }

      await sendLog(interaction, usernames, targetRole, successCount, failCount, results);

      const successList = results.filter(r => r.success).map(r => r.username);

      let message = `📊 **Mass Ranking ${usernames.length} Members to ${targetRole.name}**\n\n`;
      message += successList.map(u => `${u}`).join('\n');

      if (failCount > 0) {
        message += `\n\n❌ **${failCount} members failed**`;
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: message,
      });

      logger.info(`[MassRank] ${interaction.user.tag} ranked ${successCount}/${usernames.length} to ${targetRole.name}`);

    } catch (error) {
      logger.error('MassRank error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};