import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';

const confessionPunishModalHandler = {
  name: 'confession_modal',
  async execute(interaction, client, args) {
    try {
      const [userId] = args;
      const punishment = interaction.fields.getTextInputValue('punishment');

      await interaction.deferUpdate();

      try {
        const confessor = await client.users.fetch(userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x1a0a0a)
          .setTitle('⛰️ Divine Judgment')
          .setDescription(
            `*The candles dim as the Sisters speak in silence...*\n\n` +
            `Your confession has been heard. The Divine Sisters have decided your fate.\n\n` +
            `**Punishment:**\n*"${punishment}"*\n\n` +
            `*Accept your punishment with grace, sister. The Divine watches all.*\n\n` +
            `🕯️ — The Divine Sisters`
          )
          .setTimestamp();
        await confessor.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confession_done:done')
          .setLabel('Punished ⛰️')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
      );

      await interaction.editReply({ components: [updatedRow] });

    } catch (error) {
      logger.error('Confession modal error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

export { confessionPunishModalHandler };
