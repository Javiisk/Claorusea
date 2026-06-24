import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const confessionForgiveHandler = {
  name: 'confession_forgive',
  async execute(interaction, client, args) {
    try {
      const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
      if (!hasRole) {
        return await interaction.reply({ content: '❌ Only Divine Sisters with high rank can judge confessions.', ephemeral: true });
      }

      const [userId] = args;
      await interaction.deferUpdate();

      try {
        const confessor = await client.users.fetch(userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xf5e6c8)
          .setTitle('✝️ Divine Judgment')
          .setDescription(
            `*The candles glow softly as the Sisters speak...*\n\n` +
            `Your confession has been heard, and the Divine Sisters have granted you **forgiveness**.\n\n` +
            `*Go in peace, sister. May you not stray from the path again.*\n\n` +
            `⛪ — The Divine Sisters`
          )
          .setTimestamp();
        await confessor.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confession_done:done')
          .setLabel('Forgiven ✝️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

      await interaction.editReply({ components: [updatedRow] });

    } catch (error) {
      logger.error('Confession forgive error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

const confessionPunishHandler = {
  name: 'confession_punish',
  async execute(interaction, client, args) {
    try {
      const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
      if (!hasRole) {
        return await interaction.reply({ content: '❌ Only Divine Sisters with high rank can judge confessions.', ephemeral: true });
      }

      const [userId] = args;

      const modal = new ModalBuilder()
        .setCustomId(`confession_modal:${userId}`)
        .setTitle('Eternal Punishment');

      const punishInput = new TextInputBuilder()
        .setCustomId('punishment')
        .setLabel('What is the punishment for this sin?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 3 days of silence, extra prayers...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(punishInput));
      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Confession punish error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

export { confessionForgiveHandler, confessionPunishHandler };
