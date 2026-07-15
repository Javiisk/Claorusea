import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// ─── BOARD MAP ────────────────────────────────────────────────────────────

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

const BOARD_CHOICES = Object.keys(BOARDS).map(key => ({
  name: BOARD_NAMES[key] || key,
  value: key,
}));

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

// ─── TRELLO API FUNCTIONS ────────────────────────────────────────────────

async function getTrelloLists(boardId) {
  const res = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  return res.json();
}

async function getTrelloCards(boardId) {
  const res = await fetch(
    `https://api.trello.com/1/boards/${boardId}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  return res.json();
}

async function createTrelloCard(boardId, title, description, listId) {
  const res = await fetch(
    `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idList: listId, name: title, desc: description || '' }),
    }
  );
  return res.json();
}

async function moveTrelloCard(cardId, listId) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idList: listId }),
    }
  );
  return res.json();
}

async function addTrelloComment(cardId, comment) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: comment }),
    }
  );
  return res.json();
}

async function archiveTrelloCard(cardId) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    }
  );
  return res.json();
}

async function getTrelloActions(cardId) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&limit=10`
  );
  return res.json();
}

function getBoardId(boardKey) {
  const id = BOARDS[boardKey];
  if (!id) {
    throw new Error(`Board "${boardKey}" not found. Options: ${Object.keys(BOARDS).join(', ')}`);
  }
  return id;
}

// ─── COMMAND ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('trello')
    .setDescription('📋 Manage Trello boards from Discord')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a card in Trello')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board to create the card in')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
        .addStringOption(opt => 
          opt.setName('title')
            .setDescription('Card title')
            .setRequired(true)
        )
        .addStringOption(opt => 
          opt.setName('description')
            .setDescription('Card description')
            .setRequired(false)
        )
        .addStringOption(opt => 
          opt.setName('list')
            .setDescription('Destination list')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('move')
        .setDescription('Move a card to another list')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board of the card')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
        .addStringOption(opt => 
          opt.setName('card_id')
            .setDescription('Card ID')
            .setRequired(true)
        )
        .addStringOption(opt => 
          opt.setName('list')
            .setDescription('Destination list')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View cards on a board')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board to view')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('notify')
        .setDescription('📢 View recent activity on a board')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board to view')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('comment')
        .setDescription('Add a comment to a card')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board of the card')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
        .addStringOption(opt => 
          opt.setName('card_id')
            .setDescription('Card ID')
            .setRequired(true)
        )
        .addStringOption(opt => 
          opt.setName('message')
            .setDescription('Comment message')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Archive a card')
        .addStringOption(opt => 
          opt.setName('board')
            .setDescription('Board of the card')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
        .addStringOption(opt => 
          opt.setName('card_id')
            .setDescription('Card ID')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();
      const boardKey = interaction.options.getString('board');
      const boardId = getBoardId(boardKey);
      const boardName = BOARD_NAMES[boardKey] || boardKey;

      // ─── CREATE CARD ────────────────────────────────────────────────────

      if (subcommand === 'create') {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description') || '';
        const listName = interaction.options.getString('list');

        const lists = await getTrelloLists(boardId);
        const list = lists.find(l => l.name.toLowerCase() === listName.toLowerCase());
        if (!list) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ List "${listName}" not found on board ${boardName}. Available: ${lists.map(l => l.name).join(', ')}`,
          });
        }

        const card = await createTrelloCard(boardId, title, description, list.id);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Card Created')
          .setDescription(`**${card.name}**`)
          .addFields(
            { name: '📋 Board', value: boardName, inline: true },
            { name: '📋 List', value: list.name, inline: true },
            { name: '🔗 Link', value: `[View Card](${card.shortUrl})`, inline: true },
            { name: '🆔 ID', value: `\`${card.id}\``, inline: true }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // ─── MOVE CARD ─────────────────────────────────────────────────────

      if (subcommand === 'move') {
        const cardId = interaction.options.getString('card_id');
        const listName = interaction.options.getString('list');

        const lists = await getTrelloLists(boardId);
        const list = lists.find(l => l.name.toLowerCase() === listName.toLowerCase());
        if (!list) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ List "${listName}" not found on board ${boardName}.`,
          });
        }

        const card = await moveTrelloCard(cardId, list.id);

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ Card **${card.name}** moved to **${list.name}** on board **${boardName}**`,
        });
      }

      // ─── LIST CARDS ────────────────────────────────────────────────────

      if (subcommand === 'list') {
        const cards = await getTrelloCards(boardId);
        const openCards = cards.filter(c => !c.closed);

        if (openCards.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `📭 No open cards on board **${boardName}**.`,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(`📋 ${boardName} - Open Cards (${openCards.length})`)
          .setDescription(openCards.slice(0, 25).map((c, i) =>
            `${i + 1}. **${c.name}** ${c.desc ? `\n   ${c.desc.substring(0, 100)}${c.desc.length > 100 ? '...' : ''}` : ''}`
          ).join('\n'))
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // ─── NOTIFICATIONS ─────────────────────────────────────────────────

      if (subcommand === 'notify') {
        const cards = await getTrelloCards(boardId);
        const recentCards = cards.filter(c => !c.closed).slice(0, 5);

        if (recentCards.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `📭 No recent activity on board **${boardName}**.`,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📢 Recent Activity - ${boardName}`)
          .setDescription('Last updated cards:')
          .setTimestamp();

        for (const card of recentCards) {
          try {
            const actions = await getTrelloActions(card.id);
            const lastAction = actions[0];
            let actionText = '📌 Created';

            if (lastAction) {
              if (lastAction.type === 'updateCard') {
                actionText = `✏️ Edited by **${lastAction.memberCreator?.username || 'someone'}**`;
              } else if (lastAction.type === 'commentCard') {
                actionText = `💬 Commented by **${lastAction.memberCreator?.username || 'someone'}**`;
              } else {
                actionText = `📌 ${lastAction.type} by **${lastAction.memberCreator?.username || 'someone'}**`;
              }
            }

            const lists = await getTrelloLists(boardId);
            const list = lists.find(l => l.id === card.idList);

            embed.addFields({
              name: `📌 ${card.name}`,
              value: `📋 **List:** ${list?.name || 'Unknown'}\n🔗 [View Card](${card.shortUrl})\n${actionText}`,
              inline: false,
            });
          } catch (error) {
            logger.error('[Trello Notify] Error:', error);
          }
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('trello_view_board')
            .setLabel('📋 View Full Board')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://trello.com/b/${boardId}`)
        );

        await InteractionHelper.safeEditReply(interaction, {
          embeds: [embed],
          components: [row],
        });
      }

      // ─── COMMENT ───────────────────────────────────────────────────────

      if (subcommand === 'comment') {
        const cardId = interaction.options.getString('card_id');
        const message = interaction.options.getString('message');

        await addTrelloComment(cardId, message);

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ Comment added to card on board **${boardName}**.`,
        });
      }

      // ─── ARCHIVE ───────────────────────────────────────────────────────

      if (subcommand === 'delete') {
        const cardId = interaction.options.getString('card_id');

        const card = await archiveTrelloCard(cardId);

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ Card **${card.name}** archived on board **${boardName}**.`,
        });
      }

    } catch (error) {
      logger.error('Trello error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};