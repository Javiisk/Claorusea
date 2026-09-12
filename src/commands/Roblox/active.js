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
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INACTIVITY_PATH = join(__dirname, '../../../inactivity-data.json');

const LOG_CHANNEL_ID = '1547415435123626104';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

// ─── TRELLO VARIABLES ──────────────────────────────────────────────────────

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_INACTIVITY = process.env.TRELLO_BOARD_INACTIVITY;

// ─── TRELLO FUNCTION ──────────────────────────────────────────────────────

async function addTrelloEndComment(data) {
    if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_INACTIVITY) {
        return false;
    }

    try {
        const url = `https://api.trello.com/1/cards/${TRELLO_BOARD_INACTIVITY}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

        const comment = `**${data.robloxUsername} - Inactivity Ended Early**\n\n` +
                       `**Roblox User:** ${data.robloxUsername}\n` +
                       `**End Date:** ${data.endDate}\n` +
                       `**Restored Rank:** ${data.previousRank?.name || 'Unknown'}\n` +
                       `**Reason:** ${data.reason}\n` +
                       `**Processed by:** <@${data.processedBy}>\n` +
                       `**Status:** Completed (Early)\n` +
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
    .setDescription('End a user\'s inactivity early')
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
    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason') || 'No reason provided.';

      const inactivityData = loadInactivity();

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

      const result = await setRankByRoleId(parseInt(foundKey), foundData.previousRank.id);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to restore rank: ${result.error}`,
        });
      }

      // ─── COMENTARIO EN TRELLO ──────────────────────────────────────────────

      await addTrelloEndComment({
        robloxUsername: foundData.robloxUsername,
        endDate: foundData.endDate,
        previousRank: foundData.previousRank,
        reason: reason,
        processedBy: interaction.user.id,
      });

      foundData.status = 'completed';
      foundData.restoredAt = Date.now();
      foundData.restoredBy = interaction.user.id;
      foundData.restoredByTag = interaction.user.tag;
      foundData.restoreReason = reason;
      saveInactivity(inactivityData);

      const endDateDisplay = foundData.endDate;

      // ─── DM AL USUARIO (Components V2) ──────────────────────────────────

      try {
        const dmContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### <:RocketIcon:1502787134669590599> 𓂃 Inactivity Period'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `Greetings, **${foundData.robloxUsername}**! We are here to inform you that:`,
                '',
                'Your inactivity period has been ended early.\n> Your inactivity period has been ended early as you requested.',
                '',
                "<:WarningIcon:1518051573069123728> • If you didn't request a early inactivity end or you get the wrong rank, please ping a **Domain+** to correct this.",
              ].join('\n'),
            ),
          );

        await discordUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
        logger.info(`[Active] DM sent to ${discordUser.tag}`);
      } catch (dmError) {
        logger.warn(`[Active] Could not send DM to ${discordUser.tag}:`, dmError.message);
      }

      // ─── LOG AL CANAL (Components V2) ───────────────────────────────────

      const logContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> Inactivity Logs'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `<@${interaction.user.id}> has ended **${foundData.robloxUsername}** inactivity early! Information about this inactivity notice:`,
              '',
              `**Roblox Username**\n${foundData.robloxUsername}`,
              '',
              `**Restored Rank**\n${foundData.previousRank?.name || 'Unknown'}`,
              '',
              `**Original End Date**\n${endDateDisplay}`,
              '',
              `**Reason**\n${reason}`,
              '',
              "<:WarningIcon:1518051573069123728> • If you didn't request a early inactivity end or you get the wrong rank, please ping a **Domain+** to correct this.",
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

      // ─── RESPUESTA AL STAFF (Components V2) ─────────────────────────────

      const confirmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:VerifiedIcon:1502787139845230622> Inactivity Ended Early'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `**${foundData.robloxUsername}** has been marked as active and restored to **${foundData.previousRank.name}**.`,
              '',
              `<:AddIcon:1538060207396098130> **Moderator**\n<@${interaction.user.id}>`,
              '',
              `📅 **Processed**\n${new Date().toLocaleString()}`,
            ].join('\n'),
          ),
        );

      await InteractionHelper.safeEditReply(interaction, {
        components: [confirmContainer],
        flags: MessageFlags.IsComponentsV2,
      });

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
