import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
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
        .setMaxLength(2000)
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

      // Si es una mención (<@123456789> o <@!123456789>)
      const mentionMatch = userIdInput.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      }

      // ─── VALIDAR ID ────────────────────────────────────────────────────

      if (!/^\d{17,20}$/.test(userId)) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [errorEmbed('Invalid ID', 'Please provide a valid Discord User ID or @mention.')],
        });
      }

      // ─── OBTENER USUARIO ──────────────────────────────────────────────

      let targetUser;
      try {
        targetUser = await interaction.client.users.fetch(userId);
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [errorEmbed('User Not Found', 'No user found with that ID.')],
        });
      }

      if (targetUser.bot) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [errorEmbed('Cannot DM Bot', 'You cannot send DMs to bot accounts.')],
        });
      }

      if (message.length > 2000) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [errorEmbed('Message Too Long', 'Messages must be under 2000 characters.')],
        });
      }

      // ─── ENVIAR DM ──────────────────────────────────────────────────────

      const dmChannel = await targetUser.createDM();

      const dmEmbed = successEmbed(
        anonymous ? 'Message from the Staff Team' : `Message from ${interaction.user.tag}`,
        message
      )
        .setFooter({ text: `You cannot reply to this message. | Logger ID: ${interaction.id}` })
        .setTimestamp();

      await dmChannel.send({ embeds: [dmEmbed] });

      // ─── LOG AL CANAL ──────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('📩 DM Sent')
          .setDescription(`Staff sent a DM to **${targetUser.tag}** (${targetUser.id})`)
          .addFields(
            { name: '📝 Message', value: message.substring(0, 1000), inline: false },
            { name: '👤 Sent by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: '🔒 Anonymous', value: anonymous ? '✅ Yes' : '❌ No', inline: true }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed('DM Sent', `Successfully sent a message to **${targetUser.tag}**.`)],
      });

      logger.info(`[DM] ${interaction.user.tag} sent DM to ${targetUser.tag} (anonymous: ${anonymous})`);

    } catch (error) {
      logger.error('DM error:', error);

      if (error.code === 50007) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [errorEmbed('Error', `Could not send a DM to that user. They may have DMs disabled.`)],
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [errorEmbed('Error', `Failed to send DM: ${error.message}`)],
      });
    }
  },
};