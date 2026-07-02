import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

export default {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('📋 Setup suggestion system')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel where suggestions will be sent')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const channel = interaction.options.getChannel('channel');

      // Embed de bienvenida
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏕️ Game Suggestions')
        .setDescription(
          'Do you have any ideas for improving our game?\n' +
          'Feel free to make any suggestions, and we\'ll listen.\n' +
          'Depending on your votes, we\'ll decide whether to add them to the game or not.\n\n' +
          'Click the button below to open a direct submission form.'
        )
        .setFooter({ text: 'Whispering Pines Summer Camp' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('suggestion_open')
          .setLabel('📝 Send Suggestion')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );

      await channel.send({
        content: '<@&1513330537798959135>',
        embeds: [embed],
        components: [row],
      });

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Suggestion system setup in <#${channel.id}>`,
      });

    } catch (error) {
      logger.error('Suggestion setup error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};