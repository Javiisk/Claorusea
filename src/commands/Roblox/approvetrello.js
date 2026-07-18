import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUESTS_PATH = join(__dirname, '../../../trello-requests.json');

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

const APPROVAL_CHANNEL_ID = '1528116543848710217';
const LOG_CHANNEL_ID = '1528111897273040897';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const BOARDS = {
  main: process.env.TRELLO_BOARD_ID,
  blacklists: process.env.TRELLO_BOARD_BLACKLISTS,
  dockets: process.env.TRELLO_BOARD_DOCKETS,
  event: process.env.TRELLO_BOARD_EVENT,
  mr: process.env.TRELLO_BOARD_MR,
  staff: process.env.TRELLO_BOARD_STAFF,
};

function loadRequests() {
  if (!existsSync(REQUESTS_PATH)) {
    writeFileSync(REQUESTS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(REQUESTS_PATH, 'utf8'));
}

function saveRequests(data) {
  writeFileSync(REQUESTS_PATH, JSON.stringify(data, null, 2));
}

async function inviteMemberToBoard(boardId, email) {
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/members`);
  url.searchParams.append('email', email);
  url.searchParams.append('type', 'normal');
  url.searchParams.append('key', TRELLO_API_KEY);
  url.searchParams.append('token', TRELLO_TOKEN);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Trello API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    logger.error('[ApproveTrello] Invite error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('approvetrello')
    .setDescription('✅ Approve a Trello invitation request')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('request_id')
        .setDescription('Request ID from the approval channel')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const requestId = interaction.options.getString('request_id');
      const requests = loadRequests();

      if (!requests[requestId]) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Request **${requestId}** not found.`,
        });
      }

      const request = requests[requestId];

      if (request.status !== 'pending') {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Request **${requestId}** is already ${request.status}.`,
        });
      }

      // ─── INVITAR A TODOS LOS TABLEROS ──────────────────────────────────

      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (const [key, boardId] of Object.entries(BOARDS)) {
        if (!boardId) continue;

        const result = await inviteMemberToBoard(boardId, request.email);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
        results.push({
          board: key,
          success: result.success,
          error: result.error,
        });
      }

      // ─── ACTUALIZAR ESTADO ─────────────────────────────────────────────

      request.status = 'approved';
      request.approvedBy = interaction.user.id;
      request.approvedByTag = interaction.user.tag;
      request.approvedAt = Date.now();
      saveRequests(requests);

      // ─── ENVIAR LOG ────────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Trello Invitation Approved')
          .setDescription(`**${request.email}** has been invited to Trello.`)
          .addFields(
            { name: '✅ Invited to', value: `\`${successCount}\` boards`, inline: true },
            { name: '❌ Failed', value: `\`${failCount}\` boards`, inline: true },
            { name: '👤 Approved by', value: `${interaction.user}`, inline: true },
            { name: '👤 Requested by', value: `<@${request.requestedBy}>`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }

      // ─── RESPUESTA ─────────────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Invitation for **${request.email}** has been approved and processed! (${successCount} boards, ${failCount} failed)`,
      });

      logger.info(`[ApproveTrello] ${interaction.user.tag} approved ${request.email}`);

    } catch (error) {
      logger.error('ApproveTrello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};