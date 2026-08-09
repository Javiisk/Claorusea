// src/commands/Roblox/apply.js

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('📋 Submit a staff application'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      let dmChannel;
      try {
        dmChannel = await interaction.user.createDM();
      } catch {
        return await interaction.editReply({
          content: '❌ I cannot send you a DM. Please enable DMs from server members and try again.',
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

      // ✅ Incluir userId en el customId para que el handler sepa quién es
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_start:${interaction.user.id}`)
          .setLabel('📝 Start Application')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋')
      );

      await dmChannel.send({ embeds: [embed], components: [row] });

      await interaction.editReply({
        content: '✅ I\'ve sent you a DM with the application link! Check your DMs.',
      });

      logger.info(`[Apply] ${interaction.user.tag} started an application`);

    } catch (error) {
      logger.error('Apply command error:', error);
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ An error occurred: ${error.message}`,
          });
        } else {
          await interaction.reply({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error('Failed to send error:', e);
      }
    }
  },
};