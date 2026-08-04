import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1504301603262566440';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('📩 Send a DM to any Discord user (by ID or mention)')
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
    )
    .addBooleanOption(option =>
      option
        .setName('anonymous')
        .setDescription('Send the message anonymously (default: false)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

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
      const anonymous = interaction.options.getBoolean('anonymous') || false;

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

      if (message.length > 4000) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Message is too long. Max 4000 characters.',
        });
      }

      // ─── CONSTRUIR MENSAJE DE TEXTO ──────────────────────────────────

      let dmMessage = '';

      if (anonymous) {
        dmMessage = `📩 **Message from the Staff Team**\n\n${message}`;
      } else {
        dmMessage = `📩 **Message from ${interaction.user.tag}**\n\n${message}`;
      }

      dmMessage += `\n\n*You cannot reply to this message. | Logger ID: ${interaction.id}*`;

      // ─── ENVIAR DM (TEXTO PLANO) ──────────────────────────────────────

      try {
        await targetUser.send(dmMessage);
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not send DM to **${targetUser.tag}**. They may have DMs disabled.`,
        });
      }

      // ─── LOG AL CANAL ──────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logMessage =
          `📩 **DM Sent**\n` +
          `**To:** ${targetUser.tag} (${targetUser.id})\n` +
          `**Message:** ${message.substring(0, 1000)}\n` +
          `**Sent by:** ${interaction.user.tag} (${interaction.user.id})\n` +
          `**Anonymous:** ${anonymous ? '✅ Yes' : '❌ No'}`;

        await logChannel.send(logMessage);
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ DM sent to **${targetUser.tag}** (${targetUser.id})`,
      });

      logger.info(`[DM] ${interaction.user.tag} sent DM to ${targetUser.tag} (anonymous: ${anonymous})`);

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
