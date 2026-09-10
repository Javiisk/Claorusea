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


    const targetUser = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '<:UnverifiedIcon:1547447352795594844> You cannot time out yourself.'
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '<:UnverifiedIcon:1547447352795594844> That user is not in this server.',
      });
    }

    if (!member.moderatable) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '<:UnverifiedIcon:1547447352795594844> I cannot time out this member. Check my role position and permissions.',
      });
    }

    try {
      // ─── DM CONTAINER (Components V2) ────────────────────────────────
      const issuedTimestamp = Math.floor(Date.now() / 1000);

      const dmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:WarningIcon:1547447355576684604> You have been timeouted'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Reason**\n${reason}`),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Issued**\n<t:${issuedTimestamp}:F>`),
        );

      let dmError = false;
      try {
        await targetUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (dmError_) {
        dmError = true;
        logger.warn(`[Timeout] Could not send DM to ${targetUser.tag}. DMs are closed.`);
      }

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
                '',
                `**DM Notification**\n${dmError ? '<:UnverifiedIcon:1547447352795594844> Not sent (DMs closed)' : '<:VerifiedIcon:1547447354272260107> Sent successfully'}`,
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
        content: `<:VerifiedIcon:1547447354272260107> **${targetUser.tag}** was timed out for ${minutes} minute(s).`,
      });

    } catch (error) {
      logger.error('Timeout command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '<:UnverifiedIcon:1547447352795594844> An error occurred while trying to time out this user.',
      });
    }
  },
};
