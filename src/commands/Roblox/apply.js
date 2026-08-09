import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('📋 Submit a staff application'),

  async execute(interaction) {
    try {
      // Intentar enviar DM
      let dmChannel;
      try {
        dmChannel = await interaction.user.createDM();
      } catch {
        return await interaction.reply({
          content: '❌ I cannot send you a DM. Please enable DMs from server members and try again.',
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Staff Application')
        .setDescription('Click the button below to start your staff application.\n\n'
          + '📌 You will need to answer **21 questions** across **4 steps**.\n'
          + '⏱️ The application takes about 5-10 minutes to complete.\n\n'
          + '⚠️ Please answer all questions honestly and thoroughly.')
        .addFields(
          { name: '📝 Questions 1-5', value: 'Basic information', inline: true },
          { name: '📝 Questions 6-10', value: 'Motivation & goals', inline: true },
          { name: '📝 Questions 11-15', value: 'Scenario handling', inline: true },
          { name: '📝 Questions 16-21', value: 'Final questions', inline: true }
        )
        .setFooter({ text: 'Your answers will be reviewed by staff' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_start')
          .setLabel('📝 Start Application')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋')
      );

      await dmChannel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: '✅ I\'ve sent you a DM with the application link! Check your DMs.',
        ephemeral: true,
      });

      logger.info(`[Apply] ${interaction.user.tag} started an application`);

    } catch (error) {
      logger.error('Apply command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ An error occurred: ${error.message}`,
          ephemeral: true,
        });
      }
    }
  },
};