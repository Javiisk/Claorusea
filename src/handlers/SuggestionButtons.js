import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

const SUGGESTIONS_CHANNEL_ID = 'ID_DEL_CANAL_DE_SUGERENCIAS'; // Cambia esto al ID del canal

export default async function handleSuggestionButtons(interaction) {
  if (interaction.customId !== 'suggestion_open') return;

  // Crear modal
  const modal = new ModalBuilder()
    .setCustomId('suggestion_modal')
    .setTitle('📝 Submit a Suggestion');

  // Campo: Título
  const titleInput = new TextInputBuilder()
    .setCustomId('suggestion_title')
    .setLabel('Suggestion Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100)
    .setPlaceholder('Enter a title for your suggestion...');

  // Campo: Descripción
  const descInput = new TextInputBuilder()
    .setCustomId('suggestion_description')
    .setLabel('Suggestion Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder('Describe your suggestion in detail...');

  // Campo: Categoría
  const categoryInput = new TextInputBuilder()
    .setCustomId('suggestion_category')
    .setLabel('Category')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50)
    .setPlaceholder('e.g., Gameplay, Visuals, Events...');

  // Campo: Beneficios
  const benefitsInput = new TextInputBuilder()
    .setCustomId('suggestion_benefits')
    .setLabel('Benefits')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000)
    .setPlaceholder('What benefits would this bring to the camp?');

  // Agregar campos al modal
  const titleRow = new ActionRowBuilder().addComponents(titleInput);
  const descRow = new ActionRowBuilder().addComponents(descInput);
  const categoryRow = new ActionRowBuilder().addComponents(categoryInput);
  const benefitsRow = new ActionRowBuilder().addComponents(benefitsInput);

  modal.addComponents(titleRow, descRow, categoryRow, benefitsRow);

  await interaction.showModal(modal);
}

// ─── HANDLER PARA EL MODAL ──────────────────────────────────────────────────

export async function handleSuggestionModal(interaction) {
  if (interaction.customId !== 'suggestion_modal') return;

  try {
    // Obtener datos del modal
    const title = interaction.fields.getTextInputValue('suggestion_title');
    const description = interaction.fields.getTextInputValue('suggestion_description');
    const category = interaction.fields.getTextInputValue('suggestion_category') || 'General';
    const benefits = interaction.fields.getTextInputValue('suggestion_benefits') || 'Not specified';

    // Generar ID único para la sugerencia
    const suggestionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    // Crear embed para el canal de sugerencias
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`📝 ${title}`)
      .setDescription(description)
      .addFields(
        { name: '📂 Category', value: category, inline: true },
        { name: '👤 Submitted by', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
        { name: '🆔 Suggestion ID', value: `\`${suggestionId}\``, inline: true },
        { name: '📌 Benefits', value: benefits, inline: false },
        { name: '📊 Status', value: '⏳ Pending Review', inline: false }
      )
      .setFooter({ text: `Submitted by ${interaction.user.id}` })
      .setTimestamp();

    // Enviar al canal de sugerencias
    const channel = await interaction.client.channels.fetch(SUGGESTIONS_CHANNEL_ID);
    if (!channel) {
      await interaction.reply({
        content: '❌ Suggestions channel not found. Please contact staff.',
        ephemeral: true,
      });
      return;
    }

    // Botones para votar
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`suggestion_upvote:${suggestionId}`)
        .setLabel('👍 0')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👍'),
      new ButtonBuilder()
        .setCustomId(`suggestion_downvote:${suggestionId}`)
        .setLabel('👎 0')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('👎'),
      new ButtonBuilder()
        .setCustomId(`suggestion_comment:${suggestionId}`)
        .setLabel('💬 Comment')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId(`suggestion_status:${suggestionId}`)
        .setLabel('📊 Status')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊')
    );

    await channel.send({
      content: `<@&1513330537798959135>`,
      embeds: [embed],
      components: [row],
    });

    // Responder al usuario
    await interaction.reply({
      content: `✅ Your suggestion **"${title}"** has been submitted successfully!\n📋 Suggestion ID: \`${suggestionId}\``,
      ephemeral: true,
    });

    logger.info(`[Suggestion] ${interaction.user.tag} submitted suggestion: ${title}`);

  } catch (error) {
    logger.error('Suggestion modal error:', error);
    await interaction.reply({
      content: '❌ An error occurred while submitting your suggestion.',
      ephemeral: true,
    });
  }
}