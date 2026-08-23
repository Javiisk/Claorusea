import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SUGGESTIONS_CHANNEL_ID = '1502440575171956908';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
];

export default {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Submit a suggestion')
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Title of the suggestion!')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Add details of your suggestion and how it would work')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addStringOption(opt =>
      opt.setName('why')
        .setDescription('Why should we add this?')
        .setRequired(true)
        .setMaxLength(1000)
    ),

  async execute(interaction) {
    try {
      // Check permissions
      const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
      if (!hasRole) {
        return await interaction.reply({
          content: '❌ You don\'t have permission to use this command.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const why = interaction.options.getString('why');

      // ─── SUGGESTION EMBED ──────────────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle(`<:padlock:1540831474721366137> ${interaction.user.username}'s Suggestion`)
        .addFields(
          { 
            name: '<:AddIcon:1538060207396098130> **Title**', 
            value: title, 
            inline: false 
          },
          { 
            name: '<:SurveyIcon:1502787137278312499> **Description**', 
            value: description.length > 1024 ? description.slice(0, 1021) + '...' : description, 
            inline: false 
          },
          { 
            name: '<a:Black_Question_Mark:1538060208616636489> **Why**', 
            value: why.length > 1024 ? why.slice(0, 1021) + '...' : why, 
            inline: false 
          }
        )
        .setFooter({ text: `Suggestion from ${interaction.user.tag} • ${new Date().toLocaleString()}` })
        .setTimestamp();

      // ─── SEND TO CHANNEL ──────────────────────────────────────────────────

      const channel = await interaction.client.channels.fetch(SUGGESTIONS_CHANNEL_ID);
      if (!channel) {
        logger.error('[Suggestion] Channel not found:', SUGGESTIONS_CHANNEL_ID);
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Suggestions channel not found. Please contact staff.',
        });
      }

      const message = await channel.send({ embeds: [embed] });

      // ─── ADD REACTIONS ──────────────────────────────────────────────────────

      try {
        await message.react('<:VerifiedIcon:1502787139845230622>');
        await message.react('<:UnverifiedIcon:1502787138700443668>');
      } catch (reactError) {
        logger.warn('[Suggestion] Failed to add reactions:', reactError.message);
      }

      // ─── CONFIRMATION ──────────────────────────────────────────────────────

      const confirmEmbed = new EmbedBuilder()
        .setTitle('<:VerifiedIcon:1502787139845230622> Suggestion Submitted')
        .setColor(0x808080)
        .setDescription(`Your suggestion has been submitted to <#${SUGGESTIONS_CHANNEL_ID}>.`)
        .addFields(
          { name: '<:SurveyIcon:1502787137278312499> Title', value: title, inline: false },
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

      logger.info(`[Suggestion] ${interaction.user.tag} submitted a suggestion: ${title}`);

    } catch (error) {
      logger.error('Suggestion command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while submitting your suggestion.',
          ephemeral: true,
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};