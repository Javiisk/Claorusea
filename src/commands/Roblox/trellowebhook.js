import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBHOOKS_PATH = join(__dirname, '../../../trello-webhooks.json');

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

const BOARD_CHOICES = Object.keys(BOARDS).map(key => ({
  name: BOARD_NAMES[key] || key,
  value: key,
}));

// ─── ROLES PERMITIDOS ────────────────────────────────────────────────────

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

// ─── FUNCIONES DE TRELLO ──────────────────────────────────────────────────

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

async function createTrelloWebhook(boardId, callbackUrl) {
  const res = await fetch(
    `https://api.trello.com/1/webhooks?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callbackURL: callbackUrl,
        idModel: boardId,
        description: 'Discord Bot Webhook',
        active: true,
      }),
    }
  );
  return res.json();
}

async function getTrelloWebhooks() {
  const res = await fetch(
    `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_API_KEY}`
  );
  return res.json();
}

async function deleteTrelloWebhook(webhookId) {
  const res = await fetch(
    `https://api.trello.com/1/webhooks/${webhookId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
    {
      method: 'DELETE',
    }
  );
  return res.ok;
}

function getBoardId(boardKey) {
  const id = BOARDS[boardKey];
  if (!id) {
    throw new Error(`Board "${boardKey}" not found. Options: ${Object.keys(BOARDS).join(', ')}`);
  }
  return id;
}

function loadWebhooks() {
  if (!existsSync(WEBHOOKS_PATH)) {
    writeFileSync(WEBHOOKS_PATH, JSON.stringify([]));
  }
  return JSON.parse(readFileSync(WEBHOOKS_PATH, 'utf8'));
}

function saveWebhooks(data) {
  writeFileSync(WEBHOOKS_PATH, JSON.stringify(data, null, 2));
}

// ─── COMANDO ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('trellowebhook')
    .setDescription('🔗 Configure Trello webhooks for Discord')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Create a webhook for a board')
        .addStringOption(opt =>
          opt.setName('board')
            .setDescription('Board to monitor')
            .setRequired(true)
            .addChoices(...BOARD_CHOICES)
        )
        .addStringOption(opt =>
          opt.setName('channel')
            .setDescription('Discord channel for notifications')
            .setRequired(true)
            .addChannelTypes(0)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all active webhooks')
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a webhook')
        .addStringOption(opt =>
          opt.setName('webhook_id')
            .setDescription('Webhook ID to delete')
            .setRequired(true)
        )
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
      const subcommand = interaction.options.getSubcommand();

      // ─── SETUP ──────────────────────────────────────────────────────────

      if (subcommand === 'setup') {
        const boardKey = interaction.options.getString('board');
        const channel = interaction.options.getChannel('channel');
        const boardId = getBoardId(boardKey);
        const boardName = BOARD_NAMES[boardKey] || boardKey;

        // Obtener la URL del bot (Replit)
        const botUrl = process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.repl.co/trello-webhook`
          : 'https://claorusea--javielote94.replit.app/trello-webhook';

        // Crear webhook en Trello
        const webhook = await createTrelloWebhook(boardId, botUrl);

        // Guardar en JSON
        const webhooks = loadWebhooks();
        webhooks.push({
          id: webhook.id,
          boardId: boardId,
          boardName: boardName,
          channelId: channel.id,
          createdAt: Date.now(),
          createdBy: interaction.user.id,
        });
        saveWebhooks(webhooks);

        // Crear webhook en Discord
        const discordWebhook = await channel.createWebhook({
          name: `Trello - ${boardName}`,
          avatar: 'https://cdn.discordapp.com/attachments/.../trello-logo.png',
        });

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Trello Webhook Setup Complete')
          .setDescription(`Webhook configured for **${boardName}**`)
          .addFields(
            { name: '📋 Board', value: boardName, inline: true },
            { name: '📌 Channel', value: `${channel}`, inline: true },
            { name: '🆔 Webhook ID', value: `\`${webhook.id}\``, inline: true },
            { name: '🔗 Webhook URL', value: `\`${botUrl}\``, inline: false }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        logger.info(`[TrelloWebhook] ${interaction.user.tag} created webhook for ${boardName}`);
      }

      // ─── LIST ───────────────────────────────────────────────────────────

      if (subcommand === 'list') {
        const trelloWebhooks = await getTrelloWebhooks();
        const savedWebhooks = loadWebhooks();

        if (trelloWebhooks.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: '📭 No active webhooks found.',
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔗 Active Trello Webhooks')
          .setDescription(`**${trelloWebhooks.length}** webhook(s) active.`)
          .setTimestamp();

        for (const webhook of trelloWebhooks.slice(0, 10)) {
          const saved = savedWebhooks.find(w => w.id === webhook.id);
          embed.addFields({
            name: `📋 ${webhook.description || 'Webhook'}`,
            value: `🆔 \`${webhook.id}\`\n📌 ${saved ? `<#${saved.channelId}>` : 'Unknown channel'}\n📋 Board: ${saved?.boardName || 'Unknown'}`,
            inline: false,
          });
        }

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // ─── DELETE ─────────────────────────────────────────────────────────

      if (subcommand === 'delete') {
        const webhookId = interaction.options.getString('webhook_id');

        const success = await deleteTrelloWebhook(webhookId);

        if (!success) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ Failed to delete webhook \`${webhookId}\`.`,
          });
        }

        // Eliminar del JSON
        const webhooks = loadWebhooks();
        const updated = webhooks.filter(w => w.id !== webhookId);
        saveWebhooks(updated);

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ Webhook \`${webhookId}\` deleted successfully.`,
        });

        logger.info(`[TrelloWebhook] ${interaction.user.tag} deleted webhook ${webhookId}`);
      }

    } catch (error) {
      logger.error('TrelloWebhook error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};