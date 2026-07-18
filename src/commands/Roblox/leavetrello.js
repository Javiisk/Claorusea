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

async function getWorkspaceId() {
  try {
    const url = new URL('https://api.trello.com/1/members/me/organizations');
    url.searchParams.append('key', TRELLO_API_KEY);
    url.searchParams.append('token', TRELLO_TOKEN);

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch workspaces');
    const data = await response.json();
    return data.length > 0 ? data[0].id : null;
  } catch (error) {
    logger.error('[LeaveTrello] Get workspace error:', error);
    return null;
  }
}

async function removeMemberFromBoard(boardId, memberId) {
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/members/${memberId}`);
  url.searchParams.append('key', TRELLO_API_KEY);
  url.searchParams.append('token', TRELLO_TOKEN);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Trello API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    logger.error('[LeaveTrello] Remove from board error:', error);
    return { success: false, error: error.message };
  }
}

async function removeMemberFromWorkspace(workspaceId, memberId) {
  const url = new URL(`https://api.trello.com/1/organizations/${workspaceId}/members/${memberId}`);
  url.searchParams.append('key', TRELLO_API_KEY);
  url.searchParams.append('token', TRELLO_TOKEN);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Trello API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    logger.error('[LeaveTrello] Remove from workspace error:', error);
    return { success: false, error: error.message };
  }
}

async function getMemberIdByEmail(email) {
  try {
    // Buscar miembro por email en el workspace
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return null;

    const url = new URL(`https://api.trello.com/1/organizations/${workspaceId}/members`);
    url.searchParams.append('key', TRELLO_API_KEY);
    url.searchParams.append('token', TRELLO_TOKEN);

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch members');
    const members = await response.json();
    const member = members.find(m => m.email === email);
    return member ? member.id : null;
  } catch (error) {
    logger.error('[LeaveTrello] Get member ID error:', error);
    return null;
  }
}

// ─── COMANDO ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('leavetrello')
    .setDescription('🗑️ Remove a user from ALL Trello boards and workspace')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Email address to remove')
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

      // ─── 1. OBTENER EL MEMBER ID ──────────────────────────────────────

      const memberId = await getMemberIdByEmail(email);

      if (!memberId) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not find user with email **${email}** in the workspace.`,
        });
      }

      // ─── 2. ELIMINAR DE TODOS LOS TABLEROS ────────────────────────────

      const boardResults = [];
      let boardSuccess = 0;
      let boardFail = 0;

      for (const [key, boardId] of Object.entries(BOARDS)) {
        if (!boardId) continue;

        const result = await removeMemberFromBoard(boardId, memberId);
        const boardName = BOARD_NAMES[key] || key;

        boardResults.push({
          board: boardName,
          success: result.success,
          error: result.error,
        });

        if (result.success) boardSuccess++;
        else boardFail++;
      }

      // ─── 3. ELIMINAR DEL WORKSPACE ────────────────────────────────────

      const workspaceId = await getWorkspaceId();
      let workspaceResult = null;

      if (workspaceId) {
        workspaceResult = await removeMemberFromWorkspace(workspaceId, memberId);
      }

      // ─── 4. CREAR EMBED DE RESPUESTA ──────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(boardSuccess > 0 ? 0x57F287 : 0xED4245)
        .setTitle(boardSuccess > 0 ? '✅ User Removed from Trello' : '❌ Removal Failed')
        .setDescription(`**${email}** has been processed.`)
        .addFields(
          { name: '✅ Removed from Boards', value: `\`${boardSuccess}\``, inline: true },
          { name: '❌ Failed Boards', value: `\`${boardFail}\``, inline: true },
          { name: '🗑️ Removed from Workspace', value: workspaceResult?.success ? '✅ Yes' : '❌ No', inline: true }
        )
        .setTimestamp();

      // Lista de boards exitosos
      const successBoards = boardResults
        .filter(r => r.success)
        .map(r => r.board)
        .join(', ');

      if (successBoards) {
        embed.addFields({
          name: '📋 Boards Removed From',
          value: successBoards || 'None',
          inline: false,
        });
      }

      // Lista de boards fallidos
      const failBoards = boardResults
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

      logger.info(`[LeaveTrello] ${interaction.user.tag} removed ${email} from Trello`);

    } catch (error) {
      logger.error('LeaveTrello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};