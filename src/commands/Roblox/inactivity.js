import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INACTIVITY_PATH = join(__dirname, '../../../inactivity-data.json');

const LOG_CHANNEL_ID = '1518037992927789126';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

// ─── TRELLO VARIABLES ──────────────────────────────────────────────────────

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_INACTIVITY = process.env.TRELLO_BOARD_INACTIVITY;

const HIATUS_RANK_NAME = '❗ Abandoned';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

// ─── TRELLO FUNCTIONS ──────────────────────────────────────────────────────

async function createTrelloCard(data) {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_INACTIVITY) {
        logger.warn('[Trello] Missing credentials');
        return null;
    }

    try {
        const url = `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
        
        const cardData = {
            idList: TRELLO_BOARD_INACTIVITY,
            name: `🚫 ${data.robloxUsername} - Inactivity`,
            desc: `**Roblox User:** ${data.robloxUsername}\n**Discord User:** <@${data.discordId}> (${data.discordId})\n**Start Date:** ${data.startDate}\n**End Date:** ${data.endDate}\n**Reason:** ${data.reason}\n**Roblox Rank:** ${data.previousRank?.name || 'Unknown'}`,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('[Trello] Failed to create card:', error);
            return null;
        }

        const card = await response.json();
        logger.info(`[Trello] ✅ Card created: ${card.id}`);
        return card.id;

    } catch (error) {
        logger.error('[Trello] Error:', error);
        return null;
    }
}

async function deleteTrelloCard(cardId) {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN || !cardId) return false;

    try {
        const url = `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

        const response = await fetch(url, { method: 'DELETE' });

        if (!response.ok) {
            const error = await response.text();
            logger.error('[Trello] Failed to delete card:', error);
            return false;
        }

        logger.info(`[Trello] ✅ Card deleted: ${cardId}`);
        return true;

    } catch (error) {
        logger.error('[Trello] Error deleting:', error);
        return false;
    }
}

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

// ─── CHECK EXPIRED INACTIVITY ─────────────────────────────────────────────

async function checkExpiredInactivity(client) {
  const inactivityData = loadInactivity();
  const now = Date.now();
  let updated = false;

  for (const [key, entry] of Object.entries(inactivityData)) {
    if (entry.status === 'completed' || !entry.endTimestamp) continue;

    if (now >= entry.endTimestamp) {
      logger.info(`[Inactivity] ⏰ Expired inactivity for ${entry.robloxUsername}`);

      const currentRank = await getCurrentRank(entry.robloxId);

      if (!currentRank) {
        logger.warn(`[Inactivity] ${entry.robloxUsername} is not in the group.`);
        entry.status = 'completed';
        updated = true;
        continue;
      }

      if (currentRank.name === HIATUS_RANK_NAME) {
        const previousRankId = entry.previousRank?.id;

        if (previousRankId) {
          const result = await setRankByRoleId(entry.robloxId, previousRankId);

          if (result.success) {
            logger.info(`[Inactivity] ✅ Restored ${entry.robloxUsername}`);

            // ─── ELIMINAR TARJETA TRELLO ──────────────────────────────────────

            if (entry.trelloCardId) {
              await deleteTrelloCard(entry.trelloCardId);
            }

            try {
              const user = await client.users.fetch(entry.discordId);
              const dmEmbed = new EmbedBuilder()
                .setTitle('<:RocketIcon:1502787134669590599> 𓂃 Inactivity Period')
                .setColor(0x808080)
                .setDescription(`Greetings, **${entry.robloxUsername}**!`)
                .addFields(
                  { name: '\u200B', value: 'Your inactivity period has officially ended.\n> Your original rank was restored.', inline: false },
                  { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you got the incorrect rank please ping a **Domain+**.', inline: false },
                )
                .setTimestamp();
              await user.send({ embeds: [dmEmbed] });
            } catch {}

            try {
              const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
              if (logChannel) {
                const logEmbed = new EmbedBuilder()
                  .setTitle('<:EventIcon:1502787131611938947> Inactivity Ended')
                  .setColor(0x808080)
                  .setDescription(`**${entry.robloxUsername}** inactivity ended.`)
                  .addFields(
                    { name: '\u200B', value: `> **Roblox User:** ${entry.robloxUsername}`, inline: false },
                    { name: '\u200B', value: `> **Restored Rank:** ${entry.previousRank?.name || 'Unknown'}`, inline: false },
                  )
                  .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
              }
            } catch {}

            entry.status = 'completed';
            updated = true;
          }
        }
      }
    }
  }

  if (updated) {
    saveInactivity(inactivityData);
  }
}

// ─── CHECKER ──────────────────────────────────────────────────────────────

let checkerInitialized = false;

function startChecker(client) {
  if (checkerInitialized) return;
  checkerInitialized = true;

  setInterval(() => {
    checkExpiredInactivity(client);
  }, 60 * 60 * 1000);

  setTimeout(() => {
    checkExpiredInactivity(client);
  }, 5000);

  logger.info('[Inactivity] ✅ Auto-checker started');
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('inactivity')
    .setDescription('Register an inactivity notice')
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

    await InteractionHelper.safeDefer(interaction);

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

      if (currentRank.name === HIATUS_RANK_NAME) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `⚠️ **${robloxUsername}** is already in **${HIATUS_RANK_NAME}**.`,
        });
      }

      const roles = await getGroupRoles();
      const hiatusRole = roles.find(r => r.name === HIATUS_RANK_NAME);

      if (!hiatusRole) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank "${HIATUS_RANK_NAME}" not found.`,
        });
      }

      const result = await setRankByRoleId(robloxId, hiatusRole.id);
      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank: ${result.error}`,
        });
      }

      const inactivityData = loadInactivity();
      const key = String(robloxId);

      const [month, day, year] = endDate.split('/');
      const endDateObj = new Date(`${year}-${month}-${day}T23:59:59`);
      const endTimestamp = endDateObj.getTime();

      // ─── CREAR TARJETA TRELLO ─────────────────────────────────────────────

      const trelloCardId = await createTrelloCard({
        robloxUsername: robloxUsername,
        discordId: discordUser.id,
        startDate: startDate,
        endDate: endDate,
        reason: reason,
        previousRank: currentRank,
      });

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
        trelloCardId: trelloCardId,
      };
      saveInactivity(inactivityData);

      startChecker(interaction.client);

      // ─── LOGS ─────────────────────────────────────────────────────────────────

      const logEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> Inactivity Logs')
        .setColor(0x808080)
        .setDescription(`<@${interaction.user.id}> has registered an inactivity notice of **${robloxUsername}**!`)
        .addFields(
          { 
            name: '\u200B', 
            value: `> **Roblox Username:** ${robloxUsername}\n> **Start of inactivity notice:** ${startDate}\n> **End of Inactivity Notice:** ${endDate}\n> **Reason of inactivity notice:** ${reason}`, 
            inline: false 
          },
          { 
            name: '\u200B', 
            value: `<:WarningIcon:1518051573069123728> • If it didn't register **correctly**, remember to use the command again.`, 
            inline: false 
          },
          { 
            name: '\u200B', 
            value: `<:SurveyIcon:1502787137278312499> • Remember that ${robloxUsername} **cooldown** to start another **inactivity** notice has begun: **2 Weeks.**`, 
            inline: false 
          },
        )
        .setTimestamp();

      const dmEmbed = new EmbedBuilder()
        .setTitle('<:RocketIcon:1502787134669590599> 𓂃 Inactivity Period')
        .setColor(0x808080)
        .setDescription(`Greetings, **${robloxUsername}**!`)
        .addFields(
          { name: '\u200B', value: `> Your inactivity have been logged and will end in **${endDate}**`, inline: false },
          { name: '\u200B', value: 'Enjoy your break!', inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request this, ping a **Domain+**.', inline: false },
        )
        .setTimestamp();

      const confirmEmbed = new EmbedBuilder()
        .setTitle('<:VerifiedIcon:1502787139845230622> Inactivity Registered')
        .setColor(0x808080)
        .setDescription(`**${robloxUsername}** placed on **${hiatusRole.name}** until **${endDate}**.`)
        .addFields(
          { name: '<:AddIcon:1538060207396098130> Moderator', value: `<@${interaction.user.id}>`, inline: false },
          { name: '📅 Processed', value: new Date().toLocaleString(), inline: false },
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      try {
        await discordUser.send({ embeds: [dmEmbed] });
      } catch {}

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

    } catch (error) {
      logger.error('Inactivity error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' });
      } catch (e) {
        logger.error('Failed:', e);
      }
    }
  },
};