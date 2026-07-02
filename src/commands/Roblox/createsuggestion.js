import { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SUGGESTIONS_CHANNEL_ID = '1502440575171956908';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

export default {
  data: new SlashCommandBuilder()
    .setName('createsuggestion')
    .setDescription('📝 Create a suggestion (staff only)')
    .setDMPermission(false),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    // Crear modal
    const modal = new ModalBuilder()
      .setCustomId('suggestion_create_modal')
      .setTitle('📝 Create Suggestion');

    const titleInput = new TextInputBuilder()
      .setCustomId('suggestion_title')
      .setLabel('Suggestion Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setPlaceholder('Enter a title for your suggestion...');

    const descInput = new TextInputBuilder()
      .setCustomId('suggestion_description')
      .setLabel('Suggestion Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000)
      .setPlaceholder('Describe your suggestion in detail...');

    const categoryInput = new TextInputBuilder()
      .setCustomId('suggestion_category')
      .setLabel('Category')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(50)
      .setPlaceholder('e.g., Gameplay, Visuals, Events...');

    const titleRow = new ActionRowBuilder().addComponents(titleInput);
    const descRow = new ActionRowBuilder().addComponents(descInput);
    const categoryRow = new ActionRowBuilder().addComponents(categoryInput);

    modal.addComponents(titleRow, descRow, categoryRow);

    await interaction.showModal(modal);
  },
};