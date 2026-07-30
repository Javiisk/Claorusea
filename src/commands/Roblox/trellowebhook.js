import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBHOOKS_PATH = join(__dirname, '../../../trello-webhooks.json');

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadWebhooks() {
  if (!existsSync(WEBHOOKS_PATH)) {
    writeFileSync(WEBHOOKS_PATH, JSON.stringify([]));
  }
  return JSON.parse(readFileSync(WEBHOOKS_PATH, 'utf8'));
}

function saveWebhooks(data) {
  writeFileSync(WEBHOOKS_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('trellowebhook')
    .setDescription('🔗 Configure Trello webhooks')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup a webhook')
        .addStringOption(opt =>
          opt.setName('board')
            .setDescription('Board ID')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Discord channel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all webhooks')
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a webhook')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Webhook ID')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup') {
        const boardId = interaction.options.getString('board');
        const channel = interaction.options.getChannel('channel');

        const webhooks = loadWebhooks();
        webhooks.push({
          boardId,
          channelId: channel.id,
          createdAt: Date.now(),
        });
        saveWebhooks(webhooks);

        await interaction.editReply({
          content: `✅ Webhook configured for board \`${boardId}\` in ${channel}`,
        });
      } else if (subcommand === 'list') {
        const webhooks = loadWebhooks();
        if (webhooks.length === 0) {
          return await interaction.editReply({
            content: '📭 No webhooks configured.',
          });
        }
        const list = webhooks.map((w, i) => 
          `${i + 1}. Board: \`${w.boardId}\`, Channel: <#${w.channelId}>`
        ).join('\n');
        await interaction.editReply({
          content: `📋 **Webhooks:**\n${list}`,
        });
      } else if (subcommand === 'delete') {
        const id = parseInt(interaction.options.getString('id')) - 1;
        const webhooks = loadWebhooks();
        if (id < 0 || id >= webhooks.length) {
          return await interaction.editReply({
            content: '❌ Invalid webhook ID.',
          });
        }
        webhooks.splice(id, 1);
        saveWebhooks(webhooks);
        await interaction.editReply({
          content: '✅ Webhook deleted.',
        });
      }
    } catch (error) {
      logger.error('TrelloWebhook error:', error);
      await interaction.editReply({
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};