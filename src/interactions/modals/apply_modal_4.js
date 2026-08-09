import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

const APPLICATIONS_CHANNEL_ID = '1504301603262566440';
const tempAnswers = new Map();

export default {
  customId: 'apply_modal_4',
  async execute(interaction) {
    try {
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

      const userInfo = await getRobloxUserInfoByDiscord(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('📋 Staff Application')
        .addFields(
          { name: '👤 Applicant', value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: '🎮 Roblox Username', value: allAnswers.q1 || 'Not provided', inline: true },
          { name: '🆔 Roblox ID', value: userInfo?.id ? String(userInfo.id) : 'Not linked', inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '2. Why do you want to apply here?', value: allAnswers.q2 || 'Not provided', inline: false },
          { name: '3. Why you are better than the other applicants?', value: allAnswers.q3 || 'Not provided', inline: false },
          { name: '4. How active are you? (1-10)', value: allAnswers.q4 || 'Not provided', inline: true },
          { name: '5. What are your disadvantages and advantages?', value: allAnswers.q5 || 'Not provided', inline: false },
          { name: '6. Why should we hire you?', value: allAnswers.q6 || 'Not provided', inline: false },
          { name: '7. Why shouldn\'t you lie to the high ranks?', value: allAnswers.q7 || 'Not provided', inline: false },
          { name: '8. For you, what does the staff do?', value: allAnswers.q8 || 'Not provided', inline: false },
          { name: '9. What will you do if you don\'t pass?', value: allAnswers.q9 || 'Not provided', inline: false },
          { name: '10. What would you do if you pass the applications?', value: allAnswers.q10 || 'Not provided', inline: false },
          { name: '11. What would you do if a player was trolling or being disrespectful?', value: allAnswers.q11 || 'Not provided', inline: false },
          { name: '12. What would you do if a player was using exploits?', value: allAnswers.q12 || 'Not provided', inline: false },
          { name: '13. What would you do if a staff member was abusing their power?', value: allAnswers.q13 || 'Not provided', inline: false },
          { name: '14. What would you do if a staff member was being disrespectful?', value: allAnswers.q14 || 'Not provided', inline: false },
          { name: '15. What would you do if an HR was being disrespectful or abusing their power?', value: allAnswers.q15 || 'Not provided', inline: false },
          { name: '16. Do you accept the staff rules and that you will not abuse your power?', value: allAnswers.q16 || 'Not provided', inline: true },
          { name: '17. Provide an example of your announcements.', value: allAnswers.q17 || 'Not provided', inline: false },
          { name: '18. What is this work for you?', value: allAnswers.q18 || 'Not provided', inline: false },
          { name: '19. Have you worked in places like this?', value: allAnswers.q19 || 'Not provided', inline: true },
          { name: '20. If yes, which communities? (N/A if no)', value: allAnswers.q20 || 'Not provided', inline: false },
          { name: '21. Any questions before submitting your application?', value: allAnswers.q21 || 'No questions', inline: false }
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

      tempAnswers.delete(interaction.user.id);

      await interaction.reply({
        content: '✅ Your staff application has been submitted successfully!\n\n📌 Staff will review your application shortly.',
        ephemeral: true,
      });

      logger.info(`[Apply] ${interaction.user.tag} submitted a staff application`);

    } catch (error) {
      logger.error('Apply final modal error:', error);
      await interaction.reply({
        content: '❌ An error occurred while submitting your application.',
        ephemeral: true,
      });
    }
  },
};