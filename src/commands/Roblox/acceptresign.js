import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { pendingResignations } from './resign.js';

const LOG_CHANNEL_ID = '1518724147763740784';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const ESTEEMED_DENIZEN_RANK = 2;

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

async function getGroupRoles() {
  try {
    const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.roles || [];
  } catch {
    return [];
  }
}

async function setRankById(userId, rankNumber) {
  try {
    const roles = await getGroupRoles();
    const role = roles.find(r => r.rank === rankNumber);
    if (!role) return { success: false, error: `Rank ${rankNumber} not found.` };

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
        body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${role.id}` }),
      }
    );

    if (updateRes.ok) return { success: true, roleName: role.name };
    const err = await updateRes.json();
    return { success: false, error: err.message || 'Failed.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('acceptresign')
    .setDescription('<:VerifiedIcon:1502787139845230622> Accept a pending resignation')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user whose resignation to accept')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const resignation = pendingResignations.get(discordUser.id);

      if (!resignation) {
        return await interaction.editReply({
          content: `❌ No pending resignation found for **${discordUser.tag}**.`,
        });
      }

      pendingResignations.delete(discordUser.id);

      // ─── RANKEAR AL USUARIO ──────────────────────────────────────────────────

      const rankResult = await setRankById(parseInt(resignation.robloxId), ESTEEMED_DENIZEN_RANK);

      // ─── LOG EN EL CANAL ──────────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> Resignation Logs')
          .setColor(0x808080)
          .setDescription(`<@${interaction.user.id}> has **accepted** the resignation of **${resignation.robloxUsername}**.`)
          .addFields(
            { 
              name: '\u200B', 
              value: `> **Roblox Username:** ${resignation.robloxUsername}\n> **Discord User:** <@${resignation.discordUserId}>\n> **New Rank:** ${rankResult.success ? rankResult.roleName : 'Failed'}\n> **Processed by:** <@${interaction.user.id}>`, 
              inline: false 
            },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      // ─── DM AL USUARIO ──────────────────────────────────────────────────────

      try {
        const user = await interaction.client.users.fetch(resignation.discordUserId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
          .setColor(0x808080)
          .setDescription(`Greetings, **${resignation.robloxUsername}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: '> Your resignation has been **accepted**.', inline: false },
            { name: '\u200B', value: rankResult.success 
              ? `> You have been ranked to **${rankResult.roleName}**.` 
              : `> ⚠️ Rank change failed: ${rankResult.error}`, 
              inline: false },
            { name: '\u200B', value: '**Thank you for working with us and have a good day/night.**', inline: false },
            { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
            { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
            { name: '\u200B', value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want.', inline: false },
          )
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await interaction.editReply({
        content: `✅ Resignation for **${resignation.robloxUsername}** has been **accepted** and ranked to **${rankResult.success ? rankResult.roleName : 'Failed'}**.`,
      });

      logger.info(`[AcceptResign] ${interaction.user.tag} accepted resignation for ${resignation.robloxUsername}`);

    } catch (error) {
      logger.error('AcceptResign error:', error);
      await interaction.editReply({ content: '❌ An error occurred.' });
    }
  },
};