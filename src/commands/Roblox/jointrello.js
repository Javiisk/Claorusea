import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUESTS_PATH = join(__dirname, '../../../trello-requests.json');

// ─── CANAL DE APROBACIÓN ─────────────────────────────────────────────────

const APPROVAL_CHANNEL_ID = '1528116543848710217';

// ─── MAPA DE TABLEROS ────────────────────────────────────────────────────

const BOARDS = {
  main: process.env.TRELLO_BOARD_ID,
  blacklists: process.env.TRELLO_BOARD_BLACKLISTS,
  dockets: process.env.TRELLO_BOARD_DOCKETS,
  event: process.env.TRELLO_BOARD_EVENT,
  mr: process.env.TRELLO_BOARD_MR,
  staff: process.env.TRELLO_BOARD_STAFF,
};

const BOARD_NAMES = {
  main: '📋 Main',
  blacklists: '🚫 Blacklists',
  dockets: '📄 Dockets',
  event: '🎪 Event',
  mr: '📝 MR',
  staff: '👥 Staff',
};

// ─── ROLES PERMITIDOS ────────────────────────────────────────────────────

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

// ─── FUNCIONES DE ALMACENAMIENTO ────────────────────────────────────────

function loadRequests() {
  if (!existsSync(REQUESTS_PATH)) {
    writeFileSync(REQUESTS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(REQUESTS_PATH, 'utf8'));
}

function saveRequests(data) {
  writeFileSync(REQUESTS_PATH, JSON.stringify(data, null, 2));
}

function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ─── COMANDO ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('jointrello')
    .setDescription('📋 Request to invite a user to ALL Trello boards')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Email address to invite')
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
      const email = interaction.options.getString('email');

      // ─── VERIFICAR QUE EL EMAIL NO ESTÉ YA SOLICITADO ────────────────

      const requests = loadRequests();
      const existing = Object.values(requests).find(r => r.email === email && r.status === 'pending');
      if (existing) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ There is already a pending request for **${email}**.`,
        });
      }

      // ─── CREAR SOLICITUD ──────────────────────────────────────────────

      const requestId = generateRequestId();
      requests[requestId] = {
        id: requestId,
        email: email,
        requestedBy: interaction.user.id,
        requestedByTag: interaction.user.tag,
        status: 'pending',
        createdAt: Date.now(),
        boards: Object.keys(BOARDS),
      };
      saveRequests(requests);

      // ─── ENVIAR SOLICITUD AL CANAL DE APROBACIÓN ──────────────────────

      const channel = await interaction.client.channels.fetch(APPROVAL_CHANNEL_ID);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('📋 Trello Invitation Request')
          .setDescription(`**${interaction.user.tag}** is requesting to invite **${email}** to Trello.`)
          .addFields(
            { name: '📧 Email', value: `\`${email}\``, inline: true },
            { name: '👤 Requested by', value: `${interaction.user} (${interaction.user.id})`, inline: true },
            { name: '🆔 Request ID', value: `\`${requestId}\``, inline: true },
            { name: '📋 Boards', value: Object.keys(BOARDS).map(b => `\`${b}\``).join(', '), inline: false },
            { name: '\u200B', value: `**To approve:** \`/approvetrello ${requestId}\`\n**To decline:** \`/declinetrello ${requestId}\``, inline: false }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Request sent for approval! Request ID: \`${requestId}\``,
      });

      logger.info(`[JoinTrello] ${interaction.user.tag} requested to invite ${email} (${requestId})`);

    } catch (error) {
      logger.error('JoinTrello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};