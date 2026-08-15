import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

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

// Store pending resignations
const pendingResignations = new Map();

// ─── HELPERS ────────────────────────────────────────────────────────────────

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

// ─── COMANDO PRINCIPAL ──────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('<:EventIcon:1502787131611938947> Log a resignation')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for resignation')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('notes')
        .setDescription('Additional notes')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Resign interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'resign' });
      return;
    }

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      // Generate a unique ID for this resignation
      const resignationId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

      // Store pending resignation
      pendingResignations.set(resignationId, {
        discordUserId: discordUser.id,
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        notes: notes,
        timestamp: new Date(),
      });

      // ─── LOG EMBED ────────────────────────────────────────────────────────────

      const logEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> Resignation Logs')
        .setColor(0x808080)
        .setDescription(`<@${interaction.user.id}> has **logged** a resignation of **${robloxUsername}**! Information about this resignation:`)
        .addFields(
          { 
            name: '\u200B', 
            value: `> **Roblox Username:** ${robloxUsername}\n> **Discord Username:** <@${discordUser.id}>\n> **Discord ID:** ${discordUser.id}\n> **Reason:** ${reason}\n> **Notes:** ${notes}`, 
            inline: false 
          },
          { 
            name: '\u200B', 
            value: `<:WarningIcon:1518051573069123728> • Use /acceptresign ${resignationId} or /declineresign ${resignationId} to process this resignation.`, 
            inline: false 
          },
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // DM al usuario que se resigna
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
          .setColor(0x808080)
          .setDescription(`Greetings, **${robloxUsername}**! We are here to inform you that:`)
          .addFields(
            { 
              name: '\u200B', 
              value: '> Your resignation has been **logged** just like you already got ranked to **Inhabitant**.', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '**Thank you for working with us and have a good day/night.**', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want, just **apply** or purchase **Game Pass** again.', 
              inline: false 
            },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await InteractionHelper.safeEditReply(interaction, { 
        content: `✅ Resignation for **${robloxUsername}** has been logged in <#${LOG_CHANNEL_ID}>.` 
      });

    } catch (error) {
      logger.error('Resign command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};

// ─── ACCEPT RESIGN COMMAND ──────────────────────────────────────────────

export const acceptResign = {
  data: new SlashCommandBuilder()
    .setName('acceptresign')
    .setDescription('<:VerifiedIcon:1502787139845230622> Accept a pending resignation')
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('Resignation ID from the log')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const id = interaction.options.getString('id');
    const resignation = pendingResignations.get(id);

    if (!resignation) {
      return await interaction.editReply({
        content: '❌ Invalid resignation ID. It may have already been processed.',
      });
    }

    pendingResignations.delete(id);

    // ─── RANKEAR AL USUARIO A ESTEEMED DENIZEN ──────────────────────────────

    const rankResult = await setRankById(parseInt(resignation.robloxId), ESTEEMED_DENIZEN_RANK);

    // ─── NOTIFICAR AL USUARIO ────────────────────────────────────────────────

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
          { name: '\u200B', value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want, just **apply** or purchase **Game Pass** again.', inline: false },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
      
      // ─── LOG EN EL CANAL ────────────────────────────────────────────────────

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
    } catch { /* DMs disabled */ }

    await interaction.editReply({
      content: `✅ Resignation for **${resignation.robloxUsername}** has been **accepted** and ranked to **${rankResult.success ? rankResult.roleName : 'Failed'}**.`,
    });

    logger.info(`[Resign] ${interaction.user.tag} accepted resignation for ${resignation.robloxUsername}`);
  },
};

// ─── DECLINE RESIGN COMMAND ─────────────────────────────────────────────

export const declineResign = {
  data: new SlashCommandBuilder()
    .setName('declineresign')
    .setDescription('<:UnverifiedIcon:1502787138700443668> Decline a pending resignation')
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('Resignation ID from the log')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for declining')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const id = interaction.options.getString('id');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const resignation = pendingResignations.get(id);

    if (!resignation) {
      return await interaction.editReply({
        content: '❌ Invalid resignation ID. It may have already been processed.',
      });
    }

    pendingResignations.delete(id);

    // ─── NOTIFICAR AL USUARIO ────────────────────────────────────────────────

    try {
      const user = await interaction.client.users.fetch(resignation.discordUserId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
        .setColor(0x808080)
        .setDescription(`Greetings, **${resignation.robloxUsername}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: '> Your resignation has been **declined**.', inline: false },
          { name: '\u200B', value: `> **Reason:** ${reason}`, inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
      
      // ─── LOG EN EL CANAL ────────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> Resignation Logs')
          .setColor(0x808080)
          .setDescription(`<@${interaction.user.id}> has **declined** the resignation of **${resignation.robloxUsername}**.`)
          .addFields(
            { 
              name: '\u200B', 
              value: `> **Roblox Username:** ${resignation.robloxUsername}\n> **Discord User:** <@${resignation.discordUserId}>\n> **Reason:** ${reason}\n> **Processed by:** <@${interaction.user.id}>`, 
              inline: false 
            },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch { /* DMs disabled */ }

    await interaction.editReply({
      content: `❌ Resignation for **${resignation.robloxUsername}** has been **declined**.`,
    });

    logger.info(`[Resign] ${interaction.user.tag} declined resignation for ${resignation.robloxUsername}`);
  },
};