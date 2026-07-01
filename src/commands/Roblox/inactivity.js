import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INACTIVITY_PATH = join(__dirname, '../../../inactivity-data.json');

const LOG_CHANNEL_ID = '1518037992927789126';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

// ✅ NOMBRE EXACTO DEL RANGO (con emoji y espacio)
const HIATUS_RANK_NAME = '❗ Abandoned';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
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

async function getGroupRoles() {
  try {
    const res = await fetch(
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`,
      { headers: { 'x-api-key': API_KEY } }
    );
    if (!res.ok) {
      logger.error(`[Inactivity] Roles API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.roles || [];
  } catch (error) {
    logger.error('[Inactivity] Error fetching group roles:', error);
    return [];
  }
}

async function getCurrentRank(userId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(GROUP_ID));
    return group ? { id: group.role.id, name: group.role.name, rank: group.role.rank } : null;
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

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('inactivity')
    .setDescription('Register an inactivity notice 🚀')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('startdate')
        .setDescription('Start date (MM/DD/YYYY)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('enddate')
        .setDescription('End date (MM/DD/YYYY)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for inactivity')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Inactivity interaction defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const startDate = interaction.options.getString('startdate');
      const endDate = interaction.options.getString('enddate');
      const reason = interaction.options.getString('reason');

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const currentRank = await getCurrentRank(robloxId);
      if (!currentRank) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${robloxUsername}** is not in the group.`,
        });
      }

      // ✅ Verificar si ya está en el rango "❗ Abandoned"
      if (currentRank.name === HIATUS_RANK_NAME) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `⚠️ **${robloxUsername}** is already in **${HIATUS_RANK_NAME}**.`,
        });
      }

      // ✅ Buscar el rango por NOMBRE (con emoji y espacio)
      const roles = await getGroupRoles();
      const hiatusRole = roles.find(r => r.name === HIATUS_RANK_NAME);
      
      if (!hiatusRole) {
        logger.error(`[Inactivity] Rank "${HIATUS_RANK_NAME}" not found. Available: ${roles.map(r => r.name).join(', ')}`);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank "${HIATUS_RANK_NAME}" not found in the group.`,
        });
      }

      logger.info(`[Inactivity] Found hiatus role: ${hiatusRole.name} (ID: ${hiatusRole.id})`);

      // ✅ Cambiar al rango "❗ Abandoned"
      const result = await setRankByRoleId(robloxId, hiatusRole.id);
      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank: ${result.error}`,
        });
      }

      // Guardar en JSON
      const inactivityData = loadInactivity();
      const key = String(robloxId);

      const [month, day, year] = endDate.split('/');
      const endDateObj = new Date(`${year}-${month}-${day}T23:59:59`);
      const endTimestamp = endDateObj.getTime();

      inactivityData[key] = {
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        discordId: discordUser.id,
        discordTag: discordUser.tag,
        startDate: startDate,
        endDate: endDate,
        endTimestamp: endTimestamp,
        reason: reason,
        previousRank: {
          id: currentRank.id,
          name: currentRank.name,
          rank: currentRank.rank,
        },
        hiatusRank: {
          id: hiatusRole.id,
          name: hiatusRole.name,
        },
        registeredBy: interaction.user.id,
        registeredByTag: interaction.user.tag,
        registeredAt: Date.now(),
        status: 'active',
      };
      saveInactivity(inactivityData);

      // ─── EMBEDS ────────────────────────────────────────────────────────────

      const logEmbed = new EmbedBuilder()
        .setTitle('🔔 Inactivity Notice')
        .setColor(0xF1C40F)
        .setDescription(`**${robloxUsername}** has been placed on **${hiatusRole.name}** until **${endDate}**.`)
        .addFields(
          { name: '👤 Roblox User', value: robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '📋 Discord User', value: `<@${discordUser.id}>`, inline: true },
          { name: '📊 Previous Rank', value: currentRank.name, inline: true },
          { name: '📌 Current Rank', value: hiatusRole.name, inline: true },
          { name: '📅 Start Date', value: startDate, inline: true },
          { name: '📅 End Date', value: endDate, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '👮 Registered by', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

      const dmEmbed = new EmbedBuilder()
        .setTitle('🚀 Inactivity Notice')
        .setColor(0x5865F2)
        .setDescription(`Greetings, **${robloxUsername}**!`)
        .addFields(
          { name: '📅 End Date', value: endDate, inline: true },
          { name: '📊 Rank', value: hiatusRole.name, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '\u200B', value: '⚠️ If you didn\'t request this, ping a **Domain+** to correct this.', inline: false }
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      try {
        await discordUser.send({ embeds: [dmEmbed] });
      } catch {}

      const confirmEmbed = createEmbed({ title: '✅ Inactivity Registered', description: null })
        .setDescription(`**${robloxUsername}** has been placed on **${hiatusRole.name}** until **${endDate}**.`)
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

    } catch (error) {
      logger.error('Inactivity command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
