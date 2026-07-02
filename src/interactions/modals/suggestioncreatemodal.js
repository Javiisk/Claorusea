import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

const SUGGESTIONS_CHANNEL_ID = '1502440575171956908';

export default {
  customId: 'suggestion_create_modal',
  async execute(interaction) {
    try {
      const title = interaction.fields.getTextInputValue('suggestion_title');
      const description = interaction.fields.getTextInputValue('suggestion_description');
      const category = interaction.fields.getTextInputValue('suggestion_category') || 'General';

      const suggestionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`📝 ${title}`)
        .setDescription(description)
        .addFields(
          { name: '📂 Category', value: category, inline: true },
          { name: '👤 Submitted by', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: '🆔 Suggestion ID', value: `\`${suggestionId}\``, inline: true },
          { name: '📊 Status', value: '⏳ Pending Review', inline: false }
        )
        .setFooter({ text: `Submitted by ${interaction.user.id}` })
        .setTimestamp();

      const channel = await interaction.client.channels.fetch(SUGGESTIONS_CHANNEL_ID);
      if (!channel) {
        await interaction.reply({
          content: '❌ Suggestions channel not found.',
          ephemeral: true,
        });
        return;
      }

      const message = await channel.send({ embeds: [embed] });

      await message.react('👍');
      await message.react('👎');
      await message.react('✅');
      await message.react('❌');

      await interaction.reply({
        content: `✅ Your suggestion **"${title}"** has been posted in <#${SUGGESTIONS_CHANNEL_ID}>!`,
        ephemeral: true,
      });

      logger.info(`[Suggestion] ${interaction.user.tag} created: ${title}`);

    } catch (error) {
      logger.error('Suggestion modal error:', error);
      await interaction.reply({
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  }
};