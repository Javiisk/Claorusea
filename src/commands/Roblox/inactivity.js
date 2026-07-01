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

// Rango que se asigna durante la inactividad
const HIATUS_RANK_NAME = 'Hiatus';
const HIATUS_RANK_ID = 5; // ✅ Cambiado a 5

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
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return data.roles || [];
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
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Inactivity interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'inactivity',
      });
      return;
    }

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const startDate = interaction.options.getString('startdate');
      const endDate = interaction.options.getString('enddate');
      const reason = interaction.options.getString('reason');

      // Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      // Obtener rango actual
      const currentRank = await getCurrentRank(robloxId);
      if (!currentRank) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${robloxUsername}** is not in the group.`,
        });
      }

      // Verificar si ya está en Hiatus
      if (currentRank.name === HIATUS_RANK_NAME) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `⚠️ **${robloxUsername}** is already in **${HIATUS_RANK_NAME}**.`,
        });
      }

      // Obtener el rango "Hiatus" por ID
      const roles = await getGroupRoles();
      const hiatusRole = roles.find(r => r.id === HIATUS_RANK_ID);
      if (!hiatusRole) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank with ID ${HIATUS_RANK_ID} not found in the group.`,
        });
      }

      // Cambiar a rango Hiatus
      const result = await setRankByRoleId(robloxId, HIATUS_RANK_ID);
      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank: ${result.error}`,
        });
      }

      // Guardar en el JSON
      const inactivityData = loadInactivity();
      const key = String(robloxId);

      // Parsear fecha fin (MM/DD/YYYY)
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
          id: HIATUS_RANK_ID,
          name: HIATUS_RANK_NAME,
        },
        registeredBy: interaction.user.id,
        registeredByTag: interaction.user.tag,
        registeredAt: Date.now(),
        status: 'active', // active, completed, cancelled, error
      };
      saveInactivity(inactivityData);

      // ─── EMBEDS ────────────────────────────────────────────────────────────

      // Log embed
      const logEmbed = new EmbedBuilder()
        .setTitle('🔔 Inactivity Notice')
        .setColor(0xF1C40F)
        .setDescription(`<@${interaction.user.id}> has registered an inactivity notice for **${robloxUsername}**!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '📋 Discord User', value: `<@${discordUser.id}>`, inline: true },
          { name: '📊 Previous Rank', value: currentRank.name, inline: true },
          { name: '📌 Current Rank', value: HIATUS_RANK_NAME, inline: true },
          { name: '📅 Start Date', value: startDate, inline: true },
          { name: '📅 End Date', value: endDate, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '\u200B', value: `📋 • Remember that **${robloxUsername}** cooldown to start another inactivity notice has begun: **2 Weeks.**`, inline: false }
        )
        .setTimestamp();

      // DM embed
      const dmEmbed = new EmbedBuilder()
        .setTitle('🚀 Inactivity Period')
        .setColor(0x5865F2)
        .setDescription(`Greetings, **${robloxUsername}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: `Your inactivity has been logged and will end in **${endDate}**.`, inline: false },
          { name: '\u200B', value: `You have been placed in **${HIATUS_RANK_NAME}** until your return.`, inline: false },
          { name: '\u200B', value: '⚠️ • If you didn\'t request an inactivity notice, please ping a **Domain+** to correct this.', inline: false }
        )
        .setTimestamp();

      // Enviar al canal de logs
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // Enviar DM al usuario
      try {
        await discordUser.send({ embeds: [dmEmbed] });
      } catch {
        await InteractionHelper.safeEditReply(interaction, {
          content: `⚠️ Inactivity logged but couldn't send DM to <@${discordUser.id}> (they may have DMs disabled).`,
        });
        return;
      }

      // Respuesta de confirmación
      const confirmEmbed = createEmbed({ title: '✅ Inactivity Registered', description: null })
        .setDescription(`Inactivity notice for **${robloxUsername}** has been registered and DM sent to <@${discordUser.id}>.`)
        .addFields(
          { name: 'Start Date', value: startDate, inline: true },
          { name: 'End Date', value: endDate, inline: true },
          { name: 'Rank', value: HIATUS_RANK_NAME, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

      // Iniciar el sistema de restauración automática
      startAutoRestore(interaction.client);

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

// ─── AUTO-RESTORE SYSTEM ──────────────────────────────────────────────────

let restoreInterval = null;

function startAutoRestore(client) {
  if (restoreInterval) {
    clearInterval(restoreInterval);
    restoreInterval = null;
  }

  restoreInterval = setInterval(async () => {
    try {
      const inactivityData = loadInactivity();
      const now = Date.now();
      let changed = false;

      for (const [robloxId, data] of Object.entries(inactivityData)) {
        // Saltar si ya está completado o cancelado
        if (data.status !== 'active') continue;

        // Verificar si la fecha de fin ya pasó
        if (now >= data.endTimestamp) {
          logger.info(`[Inactivity] Restoring rank for ${data.robloxUsername} (${robloxId})`);

          // Verificar rango actual (por si acaso)
          const currentRank = await getCurrentRank(parseInt(robloxId));
          
          // Si ya está en el rango correcto, no hacer nada
          if (currentRank && currentRank.id === data.previousRank.id) {
            data.status = 'completed';
            data.restoredAt = Date.now();
            changed = true;
            logger.info(`[Inactivity] ${data.robloxUsername} already has correct rank, marking as completed.`);
            continue;
          }

          // Restaurar rango anterior
          const result = await setRankByRoleId(parseInt(robloxId), data.previousRank.id);

          if (result.success) {
            // Actualizar estado
            data.status = 'completed';
            data.restoredAt = Date.now();
            changed = true;

            // ─── ENVIAR DM AL USUARIO ──────────────────────────────────────

            try {
              const discordUser = await client.users.fetch(data.discordId);
              const dmEmbed = new EmbedBuilder()
                .setTitle('✅ Inactivity Ended')
                .setColor(0x57F287)
                .setDescription(`Greetings, **${data.robloxUsername}**!`)
                .addFields(
                  { name: '📊 Your Rank', value: `**${data.previousRank.name}** has been restored!`, inline: false },
                  { name: '📅 Inactivity Ended', value: new Date().toLocaleDateString(), inline: true },
                  { name: '📝 Reason', value: data.reason || 'No reason provided', inline: false },
                  { name: '\u200B', value: '🎉 Welcome back!', inline: false }
                )
                .setTimestamp();

              await discordUser.send({ embeds: [dmEmbed] });
              logger.info(`[Inactivity] DM sent to ${data.discordTag}`);

            } catch (dmError) {
              logger.warn(`[Inactivity] Could not send DM to ${data.discordId}:`, dmError.message);
            }

            // ─── ENVIAR LOG AL CANAL ───────────────────────────────────────

            try {
              const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
              if (logChannel) {
                const logEmbed = new EmbedBuilder()
                  .setTitle('✅ Inactivity Ended')
                  .setColor(0x57F287)
                  .setDescription(`**${data.robloxUsername}** has returned from inactivity!`)
                  .addFields(
                    { name: '👤 Roblox User', value: data.robloxUsername, inline: true },
                    { name: '🆔 Roblox ID', value: robloxId, inline: true },
                    { name: '📋 Discord User', value: `<@${data.discordId}>`, inline: true },
                    { name: '📊 Restored Rank', value: data.previousRank.name, inline: true },
                    { name: '📅 Original End Date', value: data.endDate, inline: true }
                  )
                  .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
              }
            } catch (logError) {
              logger.warn('[Inactivity] Could not send log:', logError.message);
            }

          } else {
            // Si falla la restauración, marcar como error
            data.status = 'error';
            data.error = result.error;
            changed = true;
            logger.error(`[Inactivity] Failed to restore rank for ${data.robloxUsername}: ${result.error}`);
          }
        }
      }

      if (changed) {
        saveInactivity(inactivityData);
      }

    } catch (error) {
      logger.error('[Inactivity] Auto-restore error:', error);
    }
  }, 60000); // Revisar cada minuto
}
