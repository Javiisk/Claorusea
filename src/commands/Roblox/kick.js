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
    .setName('kick')
    .setDescription('Kicks a member from the server')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;


    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot kick yourself.'
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ That user is not in this server.',
      });
    }

    if (!member.kickable) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ I cannot kick this member. Check my role position and permissions.',
      });
    }

    try {
      await member.kick(reason);

      logger.info(`[Kick] ${targetUser.tag} kicked by ${interaction.user.tag}. Reason: ${reason}`);

      // ─── LOG CONTAINER (Components V2) ───────────────────────────────
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

      if (!logChannel) {
        logger.error(`[Kick] Could not find/access the log channel with ID ${LOG_CHANNEL_ID}.`);
      } else {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### Member Kicked'),
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
          logger.error('[Kick] Failed to send the log message:', error);
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ **${targetUser.tag}** was kicked successfully.`,
      });

    } catch (error) {
      logger.error('Kick command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while trying to kick this user.',
      });
    }
  },
};
