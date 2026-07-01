import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INACTIVITY_PATH = join(__dirname, '../../../inactivity-data.json');

const LOG_CHANNEL_ID = '1518037992927789126';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

// ─── ROLES PERMITIDOS ──────────────────────────────────────────────────────

const ALLOWED_ROLES = [
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671296883757158',
  '1505671292873867544',
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function loadInactivity() {
  if (!existsSync(INACTIVITY_PATH)) {
    writeFileSync(INACTIVITY_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(INACTIVITY_PATH, 'utf8'));
}

function saveInactivity(data) {
  writeFileSync(INACTIVITY_PATH, JSON.stringify(data, null, 2));
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

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('active')
    .setDescription('✅ End a user\'s inactivity early and restore their rank')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user to mark as active')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for ending inactivity early')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason') || 'No reason provided.';

      // Cargar datos de inactividad
      const inactivityData = loadInactivity();
      
      // Buscar al usuario por Discord ID
      let foundKey = null;
      let foundData = null;

      for (const [robloxId, data] of Object.entries(inactivityData)) {
        if (data.discordId === discordUser.id && data.status === 'active') {
          foundKey = robloxId;
          foundData = data;
          break;
        }
      }

      if (!foundData) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have an active inactivity notice.`,
        });
      }

      // Restaurar rango anterior
      const result = await setRankByRoleId(parseInt(foundKey), foundData.previousRank.id);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to restore rank: ${result.error}`,
        });
      }

      // Actualizar estado
      foundData.status = 'completed';
      foundData.restoredAt = Date.now();
      foundData.restoredBy = interaction.user.id;
      foundData.restoredByTag = interaction.user.tag;
      foundData.restoreReason = reason;
      saveInactivity(inactivityData);

      // ─── DM AL USUARIO ──────────────────────────────────────────────────

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Inactivity Ended Early')
          .setColor(0x57F287)
          .setDescription(`Greetings, **${foundData.robloxUsername}**!`)
          .addFields(
            { name: '📊 Your Rank', value: `**${foundData.previousRank.name}** has been restored!`, inline: false },
            { name: '📅 Original End Date', value: foundData.endDate, inline: true },
            { name: '📝 Reason', value: reason, inline: false },
            { name: '👤 Actioned by', value: `${interaction.user.tag}`, inline: true },
            { name: '\u200B', value: '🎉 Welcome back! Your inactivity has been ended early.', inline: false }
          )
          .setTimestamp();

        await discordUser.send({ embeds: [dmEmbed] });
        logger.info(`[Active] DM sent to ${discordUser.tag}`);
      } catch (dmError) {
        logger.warn(`[Active] Could not send DM to ${discordUser.tag}:`, dmError.message);
      }

      // ─── LOG AL CANAL ──────────────────────────────────────────────────

      const logEmbed = new EmbedBuilder()
        .setTitle('✅ Inactivity Ended Early')
        .setColor(0x57F287)
        .setDescription(`**${foundData.robloxUsername}** has returned from inactivity early!`)
        .addFields(
          { name: '👤 Roblox User', value: foundData.robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: foundKey, inline: true },
          { name: '📋 Discord User', value: `<@${discordUser.id}>`, inline: true },
          { name: '📊 Restored Rank', value: foundData.previousRank.name, inline: true },
          { name: '📅 Original End Date', value: foundData.endDate, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '👤 Actioned by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      const confirmEmbed = createEmbed({ title: '✅ Inactivity Ended Early', description: null })
        .setDescription(`**${foundData.robloxUsername}** has been marked as active and restored to **${foundData.previousRank.name}**.`)
        .addFields(
          { name: 'Discord User', value: `${discordUser}`, inline: true },
          { name: 'Original End Date', value: foundData.endDate, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

    } catch (error) {
      logger.error('Active command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
