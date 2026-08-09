import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

const tempAnswers = new Map();

export default {
  customId: 'apply_modal',
  async execute(interaction) {
    try {
      // ─── OBTENER RESPUESTAS ────────────────────────────────────────────

      const answers = {
        q1: interaction.fields.getTextInputValue('q1_roblox'),
        q2: interaction.fields.getTextInputValue('q2_why_apply'),
        q3: interaction.fields.getTextInputValue('q3_better'),
        q4: interaction.fields.getTextInputValue('q4_active'),
        q5: interaction.fields.getTextInputValue('q5_advantages'),
      };

      tempAnswers.set(interaction.user.id, answers);

      // ─── MODAL 2: Preguntas 6-10 ──────────────────────────────────────

      const modal2 = new ModalBuilder()
        .setCustomId('apply_modal_2')
        .setTitle('📋 Staff Application (2/4)');

      // 6. Why should we hire you?
      const q6 = new TextInputBuilder()
        .setCustomId('q6_hire')
        .setLabel('6. Why should we hire you?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      // 7. Why shouldn't you lie to the high ranks?
      const q7 = new TextInputBuilder()
        .setCustomId('q7_lie')
        .setLabel('7. Why shouldn\'t you lie to the high ranks?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      // 8. For you, what does the staff do?
      const q8 = new TextInputBuilder()
        .setCustomId('q8_staff_role')
        .setLabel('8. For you, what does the staff do?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      // 9. What will you do if you don't pass?
      const q9 = new TextInputBuilder()
        .setCustomId('q9_not_pass')
        .setLabel('9. What will you do if you don\'t pass?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      // 10. What would you do if you pass the applications?
      const q10 = new TextInputBuilder()
        .setCustomId('q10_after_pass')
        .setLabel('10. What would you do if you pass the applications?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const row6 = new ActionRowBuilder().addComponents(q6);
      const row7 = new ActionRowBuilder().addComponents(q7);
      const row8 = new ActionRowBuilder().addComponents(q8);
      const row9 = new ActionRowBuilder().addComponents(q9);
      const row10 = new ActionRowBuilder().addComponents(q10);

      modal2.addComponents(row6, row7, row8, row9, row10);

      await interaction.showModal(modal2);

    } catch (error) {
      logger.error('Apply modal error:', error);
      await interaction.reply({
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};