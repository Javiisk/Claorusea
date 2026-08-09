import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

export default {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('📋 Submit a staff application'),

  async execute(interaction) {
    try {
      // ✅ PRIMERO: Deferir la respuesta para ganar tiempo
      await interaction.deferReply({ ephemeral: true });

      // Verificar si el usuario tiene Roblox vinculado
      const userInfo = await getRobloxUserInfoByDiscord(interaction.user.id);
      if (!userInfo) {
        return await interaction.editReply({
          content: '❌ You need to have a Roblox account linked in this server to apply.',
        });
      }

      // ─── MODAL 1: Preguntas 1-5 ──────────────────────────────────────────

      const modal = new ModalBuilder()
        .setCustomId('apply_modal')
        .setTitle('📋 Staff Application (1/4)');

      const q1 = new TextInputBuilder()
        .setCustomId('q1_roblox')
        .setLabel('1. What is your Roblox username?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(userInfo.username || '')
        .setPlaceholder('Enter your Roblox username...');

      const q2 = new TextInputBuilder()
        .setCustomId('q2_why_apply')
        .setLabel('2. Why do you want to apply here?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q3 = new TextInputBuilder()
        .setCustomId('q3_better')
        .setLabel('3. Why are you better than others?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const q4 = new TextInputBuilder()
        .setCustomId('q4_active')
        .setLabel('4. How active are you? (1-10)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('1-10');

      const q5 = new TextInputBuilder()
        .setCustomId('q5_advantages')
        .setLabel('5. What are your disadvantages/advantages?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Answer here...')
        .setMaxLength(1000);

      const row1 = new ActionRowBuilder().addComponents(q1);
      const row2 = new ActionRowBuilder().addComponents(q2);
      const row3 = new ActionRowBuilder().addComponents(q3);
      const row4 = new ActionRowBuilder().addComponents(q4);
      const row5 = new ActionRowBuilder().addComponents(q5);

      modal.addComponents(row1, row2, row3, row4, row5);

      // ✅ Mostrar el modal (reemplaza la respuesta deferida)
      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Apply command error:', error);
      try {
        await interaction.editReply({
          content: `❌ An error occurred: ${error.message}`,
        });
      } catch {
        await interaction.reply({
          content: `❌ An error occurred: ${error.message}`,
          ephemeral: true,
        });
      }
    }
  },
};