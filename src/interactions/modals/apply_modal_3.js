import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { tempAnswers } from '../../utils/applicationStore.js';

export default {
  customId: 'apply_modal_3',
  async execute(interaction) {
    try {
      const answers3 = {
        q11: interaction.fields.getTextInputValue('q11_trolling'),
        q12: interaction.fields.getTextInputValue('q12_exploits'),
        q13: interaction.fields.getTextInputValue('q13_staff_abuse'),
        q14: interaction.fields.getTextInputValue('q14_staff_disrespect'),
        q15: interaction.fields.getTextInputValue('q15_hr_abuse'),
      };

      const allAnswers = tempAnswers.get(interaction.user.id) || {};
      Object.assign(allAnswers, answers3);
      tempAnswers.set(interaction.user.id, allAnswers);

      // ─── MODAL 4 ──────────────────────────────────────────────────────────

      const modal4 = new ModalBuilder()
        .setCustomId('apply_modal_4')
        .setTitle('📋 Staff Application (4/4)');

      const q16 = new TextInputBuilder()
        .setCustomId('q16_rules')
        .setLabel('16. Accept staff rules & no abuse?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Yes / No');

      const q17 = new TextInputBuilder()
        .setCustomId('q17_announcements')
        .setLabel('17. Example of announcements?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q18 = new TextInputBuilder()
        .setCustomId('q18_work_meaning')
        .setLabel('18. What is this work for you?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q19 = new TextInputBuilder()
        .setCustomId('q19_previous_work')
        .setLabel('19. Worked in similar places?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Yes / No');

      const q20 = new TextInputBuilder()
        .setCustomId('q20_communities')
        .setLabel('20. Which communities? (N/A if no)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(500);

      const q21 = new TextInputBuilder()
        .setCustomId('q21_questions')
        .setLabel('21. Questions before submitting?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Ask anything...')
        .setMaxLength(500);

      const row16 = new ActionRowBuilder().addComponents(q16);
      const row17 = new ActionRowBuilder().addComponents(q17);
      const row18 = new ActionRowBuilder().addComponents(q18);
      const row19 = new ActionRowBuilder().addComponents(q19);
      const row20 = new ActionRowBuilder().addComponents(q20);
      const row21 = new ActionRowBuilder().addComponents(q21);

      modal4.addComponents(row16, row17, row18, row19, row20, row21);

      await interaction.showModal(modal4);

    } catch (error) {
      logger.error('Apply modal 3 error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred.',
          ephemeral: true,
        });
      }
    }
  },
};