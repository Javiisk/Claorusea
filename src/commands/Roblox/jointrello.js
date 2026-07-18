import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

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

// ─── FUNCIONES DE TRELLO ──────────────────────────────────────────────────

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

    const data = await response.json();
    return { success: true, memberId: data.id };
  } catch (error) {
    logger.error('[JoinTrello] Invite error:', error);
    return { success: false, error: error.message };
  }
}

// ─── COMANDO ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('jointrello')
    .setDescription('📋 Invite a user to ALL Trello boards')
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

      // ─── INVITAR A TODOS LOS TABLEROS ──────────────────────────────────

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const [key, boardId] of Object.entries(BOARDS)) {
        if (!boardId) continue;

        const result = await inviteMemberToBoard(boardId, email);
        const boardName = BOARD_NAMES[key] || key;

        results.push({
          board: boardName,
          success: result.success,
          error: result.error,
        });

        if (result.success) successCount++;
        else failCount++;
      }

      // ─── CREAR EMBED DE RESPUESTA ──────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(successCount > 0 ? 0x57F287 : 0xED4245)
        .setTitle(successCount > 0 ? '✅ Trello Invitation Complete' : '❌ Trello Invitation Failed')
        .setDescription(`**${email}** has been processed.`)
        .addFields(
          { name: '✅ Invited to', value: `\`${successCount}\` boards`, inline: true },
          { name: '❌ Failed', value: `\`${failCount}\` boards`, inline: true }
        )
        .setTimestamp();

      // Lista de boards exitosos
      const successBoards = results
        .filter(r => r.success)
        .map(r => r.board)
        .join(', ');

      if (successBoards) {
        embed.addFields({
          name: '📋 Boards Invited',
          value: successBoards || 'None',
          inline: false,
        });
      }

      // Lista de boards fallidos
      const failBoards = results
        .filter(r => !r.success)
        .map(r => `- ${r.board}: ${r.error}`)
        .join('\n');

      if (failBoards) {
        embed.addFields({
          name: '❌ Failed Boards',
          value: failBoards,
          inline: false,
        });
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      logger.info(`[JoinTrello] ${interaction.user.tag} invited ${email} to ${successCount} boards`);

    } catch (error) {
      logger.error('JoinTrello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};