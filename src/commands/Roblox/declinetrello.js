import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUESTS_PATH = join(__dirname, '../../../trello-requests.json');

const LOG_CHANNEL_ID = '1528111897273040897';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadRequests() {
  if (!existsSync(REQUESTS_PATH)) {
    writeFileSync(REQUESTS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(REQUESTS_PATH, 'utf8'));
}

function saveRequests(data) {
  writeFileSync(REQUESTS_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('declinetrello')
    .setDescription('❌ Decline a Trello invitation request')
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

      // ─── ACTUALIZAR ESTADO ─────────────────────────────────────────────

      request.status = 'declined';
      request.declinedBy = interaction.user.id;
      request.declinedByTag = interaction.user.tag;
      request.declinedAt = Date.now();
      saveRequests(requests);

      // ─── ENVIAR LOG ────────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Trello Invitation Declined')
          .setDescription(`Invitation for **${request.email}** has been declined.`)
          .addFields(
            { name: '👤 Declined by', value: `${interaction.user}`, inline: true },
            { name: '👤 Requested by', value: `<@${request.requestedBy}>`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ Invitation for **${request.email}** has been declined.`,
      });

      logger.info(`[DeclineTrello] ${interaction.user.tag} declined ${request.email}`);

    } catch (error) {
      logger.error('DeclineTrello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};