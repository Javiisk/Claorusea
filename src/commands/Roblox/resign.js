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
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

const LOG_CHANNEL_ID = '1547415402542407741';

// Store pending resignations (usando Discord ID como key)
export const pendingResignations = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('Log a resignation')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for resignation')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('notes')
        .setDescription('Additional notes')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Resign defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const discordUser = interaction.user;
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      // Guardar usando Discord ID como key
      pendingResignations.set(discordUser.id, {
        discordUserId: discordUser.id,
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        notes: notes,
        timestamp: new Date(),
      });

      // ─── LOG CONTAINER (Components V2) ────────────────────────────────

      const logContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:EventIcon:1502787131611938947> Resignation Logs'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `<@${interaction.user.id}> has **logged** a resignation of **${robloxUsername}**!`,
              '',
              `**Roblox Username**\n${robloxUsername}`,
              '',
              `**Discord Username**\n<@${discordUser.id}>`,
              '',
              `**Discord ID**\n${discordUser.id}`,
              '',
              `**Reason**\n${reason}`,
              '',
              `**Notes**\n${notes}`,
              '',
              `<:WarningIcon:1518051573069123728> • Use /acceptresign <@${discordUser.id}> or /declineresign <@${discordUser.id}> to process this resignation.`,
            ].join('\n'),
          ),
        );

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // Public, simple confirmation reply (the initial DM was removed —
      // only /acceptresign and /declineresign should DM the user now).
      await InteractionHelper.safeEditReply(interaction, {
        content: '<:EventIcon:1502787131611938947> Your `resignation` has been `registered`.',
      });

    } catch (error) {
      logger.error('Resign error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
