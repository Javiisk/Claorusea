import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { tempAnswers, clearApplication } from '../../utils/applicationStore.js';

const APPLICATIONS_CHANNEL_ID = process.env.APPLICATIONS_CHANNEL_ID || '1504301603262566440';

export default {
  customId: 'apply_modal_4',
  async execute(interaction) {
    try {
      if (!APPLICATIONS_CHANNEL_ID) {
        logger.error('[Apply] APPLICATIONS_CHANNEL_ID not configured');
        return await interaction.reply({
          content: '❌ Application system not configured. Contact staff.',
          ephemeral: true,
        });
      }

      const answers4 = {
        q16: interaction.fields.getTextInputValue('q16_rules'),
        q17: interaction.fields.getTextInputValue('q17_announcements'),
        q18: interaction.fields.getTextInputValue('q18_work_meaning'),
        q19: interaction.fields.getTextInputValue('q19_previous_work'),
        q20: interaction.fields.getTextInputValue('q20_communities'),
        q21: interaction.fields.getTextInputValue('q21_questions') || 'No questions',
      };

      const allAnswers = tempAnswers.get(interaction.user.id) || {};
      Object.assign(allAnswers, answers4);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('📋 Staff Application')
        .addFields(
          { name: '👤 Applicant', value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: '🎮 Roblox Username', value: allAnswers.q1 || 'Not provided', inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '2. Why apply?', value: allAnswers.q2 || 'Not provided', inline: false },
          { name: '3. Why better than others?', value: allAnswers.q3 || 'Not provided', inline: false },
          { name: '4. Activity (1-10)', value: allAnswers.q4 || 'Not provided', inline: true },
          { name: '5. Disadvantages/Advantages', value: allAnswers.q5 || 'Not provided', inline: false },
          { name: '6. Why hire you?', value: allAnswers.q6 || 'Not provided', inline: false },
          { name: '7. Why not lie to HR?', value: allAnswers.q7 || 'Not provided', inline: false },
          { name: '8. What staff does?', value: allAnswers.q8 || 'Not provided', inline: false },
          { name: '9. If you don\'t pass?', value: allAnswers.q9 || 'Not provided', inline: false },
          { name: '10. After passing?', value: allAnswers.q10 || 'Not provided', inline: false },
          { name: '11. Player trolling/disrespectful?', value: allAnswers.q11 || 'Not provided', inline: false },
          { name: '12. Exploits?', value: allAnswers.q12 || 'Not provided', inline: false },
          { name: '13. Staff abuse?', value: allAnswers.q13 || 'Not provided', inline: false },
          { name: '14. Staff disrespect?', value: allAnswers.q14 || 'Not provided', inline: false },
          { name: '15. HR abuse/disrespect?', value: allAnswers.q15 || 'Not provided', inline: false },
          { name: '16. Accept rules?', value: allAnswers.q16 || 'Not provided', inline: true },
          { name: '17. Announcements example', value: allAnswers.q17 || 'Not provided', inline: false },
          { name: '18. What is this work?', value: allAnswers.q18 || 'Not provided', inline: false },
          { name: '19. Worked similar places?', value: allAnswers.q19 || 'Not provided', inline: true },
          { name: '20. Which communities?', value: allAnswers.q20 || 'Not provided', inline: false },
          { name: '21. Questions?', value: allAnswers.q21 || 'No questions', inline: false }
        )
        .setFooter({ text: `Submitted by ${interaction.user.tag}` })
        .setTimestamp();

      const channel = await interaction.client.channels.fetch(APPLICATIONS_CHANNEL_ID);
      if (channel) {
        await channel.send({
          content: `<@&1513330537798959135>`,
          embeds: [embed],
        });
      }

      clearApplication(interaction.user.id);

      await interaction.reply({
        content: '✅ Your staff application has been submitted successfully!\n\n📌 Staff will review your application shortly.',
        ephemeral: true,
      });

      logger.info(`[Apply] ${interaction.user.tag} submitted a staff application`);

    } catch (error) {
      logger.error('Apply final modal error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while submitting your application.',
          ephemeral: true,
        });
      }
    }
  },
};