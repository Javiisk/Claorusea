import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const CONFESSION_CHANNEL_ID = '1519175871326584943';

export default {
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Confess your sins before the altar 🕯️')
    .addStringOption(opt =>
      opt.setName('sin').setDescription('What have you done, sister...').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Confession defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const sin = interaction.options.getString('sin');
      const user = interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x1a0a0a)
        .setTitle('📜 Confession Log')
        .setDescription(
          `*The candles flicker as a soul steps forward...*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🕯️ **<@${user.id}>** has confessed before the altar.\n\n` +
          `**Sin:**\n*"${sin}"*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⛪ *May the Divine Sisters grant you forgiveness... or eternal punishment.*`
        )
        .setFooter({ text: `Discord ID: ${user.id}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confession_forgive:${user.id}`)
          .setLabel('Forgive')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✝️'),
        new ButtonBuilder()
          .setCustomId(`confession_punish:${user.id}`)
          .setLabel('Punish')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⛰️'),
      );

      const channel = await interaction.client.channels.fetch(CONFESSION_CHANNEL_ID);
      await channel.send({ embeds: [embed], components: [row] });

      await InteractionHelper.safeEditReply(interaction, {
        content: '🕯️ *Your confession has been received. The altar awaits judgment...*',
      });

    } catch (error) {
      logger.error('Confession error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
