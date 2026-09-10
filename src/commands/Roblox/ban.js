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

const LOG_CHANNEL_ID = '1547414356210225203';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from the server')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;


    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot ban yourself.'
      });
    }

    try {
      await interaction.guild.members.ban(targetUser.id, { reason });

      logger.info(`[Ban] ${targetUser.tag} banned by ${interaction.user.tag}. Reason: ${reason}`);

      // ─── LOG CONTAINER (Components V2) ───────────────────────────────
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

      if (!logChannel) {
        logger.error(`[Ban] Could not find/access the log channel with ID ${LOG_CHANNEL_ID}.`);
      } else {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### Member Banned'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**User**\n<@${targetUser.id}> (${targetUser.tag})`,
                '',
                `**Moderator**\n${interaction.user.tag}`,
                '',
                `**Reason**\n${reason}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch((error) => {
          logger.error('[Ban] Failed to send the log message:', error);
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ **${targetUser.tag}** was banned successfully.`,
      });

    } catch (error) {
      logger.error('Ban command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while trying to ban this user. They may not be bannable.',
      });
    }
  },
};
