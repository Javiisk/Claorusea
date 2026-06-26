import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const STAFF_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912'
];

export default {
  data: new SlashCommandBuilder()
    .setName('embedcreate')
    .setDescription('🎨 Create a custom embed')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed title')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed description')
        .setRequired(false)
        .setMaxLength(4000))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Hex color (e.g., #FF5733)')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send the embed')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await InteractionHelper.safeDefer(interaction, { ephemeral: true });

      const member = interaction.member;
      const hasStaffRole = STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
      
      if (!hasStaffRole) {
        return InteractionHelper.safeReply(interaction, {
          content: '❌ Staff only.',
          ephemeral: true
        });
      }

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const colorInput = interaction.options.getString('color');
      const targetChannel = interaction.options.getChannel('channel');

      if (!targetChannel) {
        return InteractionHelper.safeReply(interaction, {
          content: '❌ Channel not found.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder();
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      
      if (colorInput) {
        let hexColor = colorInput;
        if (!hexColor.startsWith('#')) hexColor = `#${hexColor}`;
        try {
          embed.setColor(parseInt(hexColor.replace('#', ''), 16));
        } catch {
          embed.setColor('#5865F2');
        }
      } else {
        embed.setColor('#5865F2');
      }

      embed.setTimestamp();

      await targetChannel.send({ embeds: [embed] });
      await InteractionHelper.safeReply(interaction, {
        content: `✅ Embed sent to <#${targetChannel.id}>`,
        ephemeral: true
      });

    } catch (error) {
      logger.error(`[EmbedCreate] Error: ${error.message}`);
      await InteractionHelper.safeReply(interaction, {
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
