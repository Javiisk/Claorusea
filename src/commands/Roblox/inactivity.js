import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
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

// ─── DATE HELPERS ───────────────────────────────────────────────────────────

// Parses a MM/DD/YYYY string into a Unix timestamp (seconds), for use in
// Discord's <t:...:F> timestamp format.
function toUnixSeconds(dateStr, endOfDay = false) {
  const [month, day, year] = dateStr.split('/');
  const dateObj = new Date(`${year}-${month}-${day}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Math.floor(dateObj.getTime() / 1000);
}

// ─── TRELLO FUNCTIONS ──────────────────────────────────────────────────────

async function addTrelloComment(data) {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_INACTIVITY) {
        logger.warn('[Trello] Missing credentials');
        return false;
    }

    try {
        const url = `https://api.trello.com/1/cards/${TRELLO_BOARD_INACTIVITY}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

        const comment = `**${data.robloxUsername} - Inactivity Started**\n\n` +
                       `**Roblox User:** ${data.robloxUsername}\n` +
                       `**Discord User:** <@${data.discordId}> (${data.discordId})\n` +
                       `**Start Date:** ${data.startDate}\n` +
                       `**End Date:** ${data.endDate}\n` +
                       `**Reason:** ${data.reason}\n` +
                       `**Roblox Rank:** ${data.previousRank?.name || 'Unknown'}\n` +
                       `**Registered by:** <@${data.registeredBy}>\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment }),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('[Trello] Failed to add comment:', error);
            return false;
        }

        logger.info(`[Trello] ✅ Comment added for ${data.robloxUsername}`);
        return true;

    } catch (error) {
        logger.error('[Trello] Error:', error);
        return false;
    }
}

async function addTrelloEndComment(data) {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_INACTIVITY) {
        return false;
    }

    try {
        const url = `https://api.trello.com/1/cards/${TRELLO_BOARD_INACTIVITY}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

        const comment = `**${data.robloxUsername} - Inactivity Ended**\n\n` +
                       `**Roblox User:** ${data.robloxUsername}\n` +
                       `**End Date:** ${data.endDate}\n` +
                       `**Restored Rank:** ${data.previousRank?.name || 'Unknown'}\n` +
                       `**Status:** Completed\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment }),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error('[Trello] Failed to add end comment:', error);
            return false;
        }

        logger.info(`[Trello] ✅ End comment added for ${data.robloxUsername}`);
        return true;

    } catch (error) {
        logger.error('[Trello] Error:', error);
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

            // ─── COMENTARIO EN TRELLO ──────────────────────────────────────────

            await addTrelloEndComment({
                robloxUsername: entry.robloxUsername,
                endDate: entry.endDate,
                previousRank: entry.previousRank,
            });

            try {
              const user = await client.users.fetch(entry.discordId);
              const dmContainer = new ContainerBuilder()
                .setAccentColor(null)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent('### <:RocketIcon:1502787134669590599> 𓂃 Inactivity Period'),
                )
                .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    [
                      `Greetings, **${entry.robloxUsername}**!`,
                      '',
                      'Your inactivity period has officially ended.\n> Your original rank was restored.',
                      '',
                      '<:WarningIcon:1518051573069123728> • If you got the incorrect rank please ping a **Domain+**.',
                    ].join('\n'),
                  ),
                );
              await user.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2,
              });
            } catch {}

            try {
              const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
              if (logChannel) {
                const logContainer = new ContainerBuilder()
                  .setAccentColor(null)
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> Inactivity Ended'),
                  )
                  .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                      [
                        `**${entry.robloxUsername}** inactivity ended.`,
                        '',
                        `**Roblox User**\n${entry.robloxUsername}`,
                        '',
                        `**Restored Rank**\n${entry.previousRank?.name || 'Unknown'}`,
                      ].join('\n'),
                    ),
                  );
                await logChannel.send({
                  components: [logContainer],
                  flags: MessageFlags.IsComponentsV2,
                });
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

      const startTimestamp = toUnixSeconds(startDate, false);
      const endTimestamp = toUnixSeconds(endDate, true) * 1000; // stored in ms, as before

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

      startChecker(interaction.client);

      // ─── COMENTARIO EN TRELLO ──────────────────────────────────────────────

      await addTrelloComment({
        robloxUsername: robloxUsername,
        discordId: discordUser.id,
        startDate: startDate,
        endDate: endDate,
        reason: reason,
        previousRank: currentRank,
        registeredBy: interaction.user.id,
      });

      // ─── LOGS (Components V2) ───────────────────────────────────────────────

      const logContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> Inactivity Logs'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `<@${interaction.user.id}> has registered an inactivity notice of **${robloxUsername}**!`,
              '',
              `**Roblox Username**\n${robloxUsername}`,
              '',
              `**Start of inactivity notice**\n<t:${startTimestamp}:F>`,
              '',
              `**End of Inactivity Notice**\n<t:${Math.floor(endTimestamp / 1000)}:F>`,
              '',
              `**Reason of inactivity notice**\n${reason}`,
              '',
              `<:WarningIcon:1518051573069123728> • If it didn't register **correctly**, remember to use the command again.`,
              '',
              `<:SurveyIcon:1502787137278312499> • Remember that ${robloxUsername} **cooldown** to start another **inactivity** notice has begun: **2 Weeks.**`,
            ].join('\n'),
          ),
        );

      const dmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:RocketIcon:1502787134669590599> 𓂃 Inactivity Period'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `Greetings, **${robloxUsername}**!`,
              '',
              `Your inactivity have been logged and will end <t:${Math.floor(endTimestamp / 1000)}:F>`,
              '',
              'Enjoy your break!',
              '',
              "<:WarningIcon:1518051573069123728> • If you didn't request this, ping a **Domain+**.",
            ].join('\n'),
          ),
        );

      const confirmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:VerifiedIcon:1502787139845230622> Inactivity Registered'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `**${robloxUsername}** placed on **${hiatusRole.name}** until <t:${Math.floor(endTimestamp / 1000)}:F>.`,
              '',
              `<:AddIcon:1538060207396098130> **Moderator**\n<@${interaction.user.id}>`,
              '',
              `📅 **Processed**\n<t:${Math.floor(Date.now() / 1000)}:F>`,
            ].join('\n'),
          ),
        );

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      try {
        await discordUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch {}

      await InteractionHelper.safeEditReply(interaction, {
        components: [confirmContainer],
        flags: MessageFlags.IsComponentsV2,
      });

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
