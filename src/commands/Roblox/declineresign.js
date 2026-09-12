import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { pendingResignations } from './resign.js';

const LOG_CHANNEL_ID = '1547415402542407741';

export default {
  data: new SlashCommandBuilder()
    .setName('declineresign')
    .setDescription('Decline a pending resignation')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user whose resignation to decline')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for declining')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const resignation = pendingResignations.get(discordUser.id);

      if (!resignation) {
        return await interaction.editReply({
          content: `❌ No pending resignation found for **${discordUser.tag}**.`,
        });
      }

      pendingResignations.delete(discordUser.id);

      // ─── LOG CONTAINER (Components V2) ────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> Resignation Logs'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `<@${interaction.user.id}> has **declined** the resignation of **${resignation.robloxUsername}**.`,
                '',
                `**Roblox Username**\n${resignation.robloxUsername}`,
                '',
                `**Discord User**\n<@${resignation.discordUserId}>`,
                '',
                `**Reason**\n${reason}`,
                '',
                `**Processed by**\n<@${interaction.user.id}>`,
              ].join('\n'),
            ),
          );
        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // ─── DM CONTAINER (Components V2) ──────────────────────────────────

      try {
        const user = await interaction.client.users.fetch(resignation.discordUserId);
        const dmContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> 𓂃 Resignation Notice'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `Greetings, **${resignation.robloxUsername}**! We are here to inform you that:`,
                '',
                'Your resignation has been **declined**.',
                '',
                `**Reason**\n${reason}`,
                '',
                '<:WarningIcon:1518051573069123728> • If you think this high rank made a **mistake**, ping a **Domain+**.',
                '',
                "<:WarningIcon:1518051573069123728> • If you didn't request a resignation, please ping a **Domain+** to correct this.",
              ].join('\n'),
            ),
          );
        await user.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch { /* DMs disabled */ }

      // Public, simple confirmation reply.
      await interaction.editReply({
        content: '<:EventIcon:1502787131611938947> Your `resignation` has been `declined`.',
      });

      logger.info(`[DeclineResign] ${interaction.user.tag} declined resignation for ${resignation.robloxUsername}`);

    } catch (error) {
      logger.error('DeclineResign error:', error);
      await interaction.editReply({ content: '❌ An error occurred.' });
    }
  },
};
