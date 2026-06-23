import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';

const resignDeclineModalHandler = {
  name: 'resign_modal',
  async execute(interaction, client) {
    try {
      const parts = interaction.customId.split('_');
      const discordUserId = parts[2];
      const robloxUser = parts[4];
      const declineReason = interaction.fields.getTextInputValue('decline_reason');

      await interaction.deferUpdate();

      // DM al usuario declinado
      try {
        const discordUser = await client.users.fetch(discordUserId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('🚀 ‿ Resignation Notice')
          .setColor(0xED4245)
          .setDescription(`Greetings, **${robloxUser}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: 'Your resignation has been **declined**.', inline: false },
            { name: 'Reason:', value: declineReason, inline: false },
            { name: '\u200B', value: '⚠️ • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
            { name: '\u200B', value: '⚠️ • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      // Deshabilitar botones
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('resign_done')
          .setLabel('Declined ✖️')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
      );

      await interaction.editReply({ components: [updatedRow] });

    } catch (error) {
      logger.error('Resign modal error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

export { resignDeclineModalHandler };
