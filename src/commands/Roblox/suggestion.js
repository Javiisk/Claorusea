import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SUGGESTIONS_CHANNEL_ID = '1546998163716571206';

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
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const why = interaction.options.getString('why');

      // ─── SUGGESTION CONTAINER (Components V2) ─────────────────────────

      const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### <:padlock:1540831474721366137> ${interaction.user.username}'s Suggestion`,
          ),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `<:AddIcon:1538060207396098130> **Title**\n${title}`,
              '',
              `<:SurveyIcon:1502787137278312499> **Description**\n${description.length > 1024 ? description.slice(0, 1021) + '...' : description}`,
              '',
              `<a:Black_Question_Mark:1538060208616636489> **Why**\n${why.length > 1024 ? why.slice(0, 1021) + '...' : why}`,
            ].join('\n'),
          ),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Suggestion from ${interaction.user.tag} • ${new Date().toLocaleString()}`,
          ),
        );

      // ─── SEND TO CHANNEL ──────────────────────────────────────────────

      const channel = await interaction.client.channels.fetch(SUGGESTIONS_CHANNEL_ID).catch(() => null);
      if (!channel) {
        logger.error('[Suggestion] Channel not found:', SUGGESTIONS_CHANNEL_ID);
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Suggestions channel not found. Please contact staff.',
        });
      }

      const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      // ─── ADD REACTIONS ──────────────────────────────────────────────────

      try {
        await message.react('<:VerifiedIcon:1502787139845230622>');
        await message.react('<:UnverifiedIcon:1502787138700443668>');
      } catch (reactError) {
        logger.warn('[Suggestion] Failed to add reactions:', reactError.message);
      }

      // ─── CONFIRMATION (Components V2) ────────────────────────────────

      const confirmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '### <:VerifiedIcon:1502787139845230622> Suggestion Submitted',
          ),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `Your suggestion has been submitted to <#${SUGGESTIONS_CHANNEL_ID}>.`,
              '',
              `<:SurveyIcon:1502787137278312499> **Title**\n${title}`,
            ].join('\n'),
          ),
        );

      await InteractionHelper.safeEditReply(interaction, {
        components: [confirmContainer],
        flags: MessageFlags.IsComponentsV2,
      });

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
