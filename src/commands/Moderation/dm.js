import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1547358082995060756';

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to any member')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('Discord User ID (17-20 digit number, or @mention)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to send')
        .setRequired(true)
        .setMaxLength(4000)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('DM interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'dm',
      });
      return;
    }

    try {
      const userIdInput = interaction.options.getString('user_id');
      const message = interaction.options.getString('message');

      // ─── EXTRAER ID DE MENCIONES ──────────────────────────────────────

      let userId = userIdInput;
      const mentionMatch = userIdInput.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      }

      // ─── VALIDAR ID ────────────────────────────────────────────────────

      if (!/^\d{17,20}$/.test(userId)) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Invalid Discord User ID. Must be a 17-20 digit number or @mention.',
        });
      }

      // ─── OBTENER USUARIO ──────────────────────────────────────────────

      let targetUser;
      try {
        targetUser = await interaction.client.users.fetch(userId);
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ User not found. Please check the ID.',
        });
      }

      if (targetUser.bot) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ You cannot send DMs to bot accounts.',
        });
      }

      // ─── CONSTRUIR DM (COMPONENTS V2) ──────────────────────────────────

      const dmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### You have received a DM'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(message),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# Message sent from Adoresa'),
        );

      // ─── ENVIAR DM ──────────────────────────────────────────────────────

      try {
        await targetUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not send DM to **${targetUser.tag}**. They may have DMs disabled.`,
        });
      }

      // ─── LOG AL CANAL (COMPONENTS V2) ──────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### DM Sent'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**To**\n<@${targetUser.id}> (${targetUser.tag})`,
                '',
                `**Sent by**\n${interaction.user.tag}`,
                '',
                `**Message**\n${message.substring(0, 1000)}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch((error) => {
          logger.error('[DM] Failed to send the log message:', error);
        });
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ DM sent to **${targetUser.tag}** (${targetUser.id})`,
      });

      logger.info(`[DM] ${interaction.user.tag} sent DM to ${targetUser.tag}`);

    } catch (error) {
      logger.error('DM error:', error);

      if (error.code === 50007) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not send DM. The user may have DMs disabled.',
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};
