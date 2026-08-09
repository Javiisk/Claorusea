import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { tempAnswers } from '../../utils/applicationStore.js';

export default {
  customId: 'apply_modal_2',
  async execute(interaction) {
    try {
      const answers2 = {
        q6: interaction.fields.getTextInputValue('q6_hire'),
        q7: interaction.fields.getTextInputValue('q7_lie'),
        q8: interaction.fields.getTextInputValue('q8_staff_role'),
        q9: interaction.fields.getTextInputValue('q9_not_pass'),
        q10: interaction.fields.getTextInputValue('q10_after_pass'),
      };

      const allAnswers = tempAnswers.get(interaction.user.id) || {};
      Object.assign(allAnswers, answers2);
      tempAnswers.set(interaction.user.id, allAnswers);

      // ─── MODAL 3 ──────────────────────────────────────────────────────────

      const modal3 = new ModalBuilder()
        .setCustomId('apply_modal_3')
        .setTitle('📋 Staff Application (3/4)');

      const q11 = new TextInputBuilder()
        .setCustomId('q11_trolling')
        .setLabel('11. Player trolling/disrespectful?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q12 = new TextInputBuilder()
        .setCustomId('q12_exploits')
        .setLabel('12. What if a player uses exploits?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q13 = new TextInputBuilder()
        .setCustomId('q13_staff_abuse')
        .setLabel('13. What if staff abuses power?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q14 = new TextInputBuilder()
        .setCustomId('q14_staff_disrespect')
        .setLabel('14. What if staff is disrespectful?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q15 = new TextInputBuilder()
        .setCustomId('q15_hr_abuse')
        .setLabel('15. HR abuse/disrespect?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const row11 = new ActionRowBuilder().addComponents(q11);
      const row12 = new ActionRowBuilder().addComponents(q12);
      const row13 = new ActionRowBuilder().addComponents(q13);
      const row14 = new ActionRowBuilder().addComponents(q14);
      const row15 = new ActionRowBuilder().addComponents(q15);

      modal3.addComponents(row11, row12, row13, row14, row15);

      await interaction.showModal(modal3);

    } catch (error) {
      logger.error('Apply modal 2 error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred.',
          ephemeral: true,
        });
      }
    }
  },
};