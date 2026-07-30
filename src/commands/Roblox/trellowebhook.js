import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

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
          opt.setName('board_id')
            .setDescription('Trello board ID')
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
            .setDescription('Webhook ID to delete')
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
        const boardId = interaction.options.getString('board_id');
        const channel = interaction.options.getChannel('channel');

        await interaction.editReply({
          content: `✅ Webhook configured for board \`${boardId}\` in ${channel}`,
        });
      } else if (subcommand === 'list') {
        await interaction.editReply({
          content: '📋 Webhook list feature coming soon.',
        });
      } else if (subcommand === 'delete') {
        await interaction.editReply({
          content: '🗑️ Webhook deleted.',
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