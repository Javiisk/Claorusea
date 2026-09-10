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
import { hasAllowedRole } from '../../utils/permissions.js';

const LOG_CHANNEL_ID = '1547414356210225203';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Times out (mutes) a member for a set number of minutes')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to time out')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('minutes')
        .setDescription('Duration of the timeout in minutes (max 40320 = 28 days)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    if (!hasAllowedRole(interaction.member)) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot use this command.',
      });
    }

    const targetUser = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot time out yourself.'
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ That user is not in this server.',
      });
    }

    if (!member.moderatable) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ I cannot time out this member. Check my role position and permissions.',
      });
    }

    try {
      await member.timeout(minutes * 60 * 1000, reason);

      logger.info(`[Timeout] ${targetUser.tag} timed out for ${minutes} minute(s) by ${interaction.user.tag}. Reason: ${reason}`);

      // ─── LOG CONTAINER (Components V2) ───────────────────────────────
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      const untilTimestamp = Math.floor((Date.now() + minutes * 60 * 1000) / 1000);

      if (!logChannel) {
        logger.error(`[Timeout] Could not find/access the log channel with ID ${LOG_CHANNEL_ID}.`);
      } else {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### Member Timed Out'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**User**\n<@${targetUser.id}> (${targetUser.tag})`,
                '',
                `**Moderator**\n${interaction.user.tag}`,
                '',
                `**Duration**\n${minutes} minute(s)`,
                '',
                `**Until**\n<t:${untilTimestamp}:F>`,
                '',
                `**Reason**\n${reason}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch((error) => {
          logger.error('[Timeout] Failed to send the log message:', error);
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ **${targetUser.tag}** was timed out for ${minutes} minute(s).`,
      });

    } catch (error) {
      logger.error('Timeout command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while trying to time out this user.',
      });
    }
  },
};
